/**
 * api/plan-carousel.js
 * OpenAI 조사 → Claude 기획 → OpenAI 검수 → Claude 부분 수정
 */
export const maxDuration = 120;

const SEARCH_KEYWORDS = ["검색","조사","최신","최근","트렌드","통계","출처","근거","사례","보고서","2025","2026"];
const TEMPLATE_TYPES = ["photo-hook","editorial-photo","big-number","metric-comparison","insight-cards","process-flow","photo-data-hybrid","cta-minimal"];
const ROLES = ["hook","context","fact","misconception","observation","behavior","evidence","comparison","case","implication","insight","strategy","opportunity","solution","action","conclusion","cta"];

function safeMessages(messages = []) {
  return messages.filter(m => m && ["user","assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-20).map(m => ({ role:m.role, content:m.content.slice(0,8000) }));
}
function needsWebSearch(messages) {
  const text = messages.filter(m=>m.role==="user").slice(-6).map(m=>m.content).join("\n").toLowerCase();
  return SEARCH_KEYWORDS.some(k=>text.includes(k));
}
function stripCodeFence(value="") {
  return String(value).trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
}
function extractResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts=[];
  for (const item of data?.output||[]) if(item?.type==="message") for(const c of item.content||[]) if(c?.type==="output_text"&&c.text) parts.push(c.text);
  return parts.join("\n\n").trim();
}
function extractWebSources(data) {
  const result=[], seen=new Set();
  const add=s=>{const url=String(s?.url||s?.link||"").trim(); if(!/^https?:\/\//i.test(url)||seen.has(url))return; seen.add(url); result.push({title:String(s?.title||s?.name||"웹 자료"),url});};
  for(const item of data?.output||[]){
    if(item?.type==="web_search_call") (item?.action?.sources||item?.sources||[]).forEach(add);
    if(item?.type==="message") for(const c of item.content||[]) for(const a of c?.annotations||[]) if(a?.type==="url_citation") add(a);
  }
  return result.slice(0,20);
}

const ITEM_SCHEMA={type:"object",additionalProperties:false,required:["label","value","note"],properties:{label:{type:"string"},value:{type:"string"},note:{type:"string"}}};
const SOURCE_SCHEMA={type:"object",additionalProperties:false,required:["claimType","sourceTitle","sourceOrganization","sourceYear","sourceUrl","sourceNote"],properties:{claimType:{type:"string",enum:["researched_fact","case_reference","background_reference"]},sourceTitle:{type:"string"},sourceOrganization:{type:"string"},sourceYear:{type:"string"},sourceUrl:{type:"string"},sourceNote:{type:"string"}}};
const PAGE_SCHEMA={type:"object",additionalProperties:false,required:["pageNumber","role","templateType","photoRequirement","label","title","titleLines","body","bodyLines","koreanPromptSummary","englishImagePrompt","imageComposition","visualData","sources"],properties:{
  pageNumber:{type:"integer"}, role:{type:"string",enum:ROLES}, templateType:{type:"string",enum:TEMPLATE_TYPES}, photoRequirement:{type:"string",enum:["required","optional","none"]},
  label:{type:"string"}, title:{type:"string"}, titleLines:{type:"array",minItems:1,maxItems:3,items:{type:"string"}}, body:{type:"string"}, bodyLines:{type:"array",maxItems:4,items:{type:"string"}},
  koreanPromptSummary:{type:"string"}, englishImagePrompt:{type:"string"},
  imageComposition:{type:"object",additionalProperties:false,required:["subjectPosition","reservedTextArea","cameraShot","backgroundDensity"],properties:{subjectPosition:{type:"string",enum:["left","left-center","center","right-center","right","upper","lower"]},reservedTextArea:{type:"string",enum:["upper-left","upper-center","upper-right","middle-left","middle-right","lower-left","lower-center","lower-right"]},cameraShot:{type:"string",enum:["close-up","medium","medium-wide","wide","over-the-shoulder","high-angle","low-angle"]},backgroundDensity:{type:"string",enum:["low","medium"]}}},
  visualData:{type:"object",additionalProperties:false,required:["eyebrow","primaryValue","primaryLabel","items","footerNote"],properties:{eyebrow:{type:"string"},primaryValue:{type:"string"},primaryLabel:{type:"string"},items:{type:"array",maxItems:4,items:ITEM_SCHEMA},footerNote:{type:"string"}}},
  sources:{type:"array",maxItems:4,items:SOURCE_SCHEMA}
}};
const RESPONSE_SCHEMA={type:"object",additionalProperties:false,required:["isComplete","chatReply","searchUsed","projectTitle","storyboard","instagramPost"],properties:{
  isComplete:{type:"boolean"},chatReply:{type:"string"},searchUsed:{type:"boolean"},projectTitle:{type:"string"},
  storyboard:{type:"object",additionalProperties:false,required:["pages"],properties:{pages:{type:"array",minItems:0,maxItems:5,items:PAGE_SCHEMA}}},
  instagramPost:{type:"object",additionalProperties:false,required:["captions","cta","hashtags"],properties:{captions:{type:"object",additionalProperties:false,required:["short","informative","conversational"],properties:{short:{type:"string"},informative:{type:"string"},conversational:{type:"string"}}},cta:{type:"string"},hashtags:{type:"array",maxItems:18,items:{type:"string"}}}}
}};
const REVIEW_SCHEMA={type:"object",additionalProperties:false,required:["pass","overallScore","summary","issues"],properties:{pass:{type:"boolean"},overallScore:{type:"number"},summary:{type:"string"},issues:{type:"array",maxItems:10,items:{type:"object",additionalProperties:false,required:["pageNumber","severity","issue","instruction"],properties:{pageNumber:{type:"integer"},severity:{type:"string",enum:["low","medium","high"]},issue:{type:"string"},instruction:{type:"string"}}}}}};

async function researchWithOpenAI(model,messages){
  const conversation=messages.map(m=>`${m.role==="assistant"?"AI":"사용자"}: ${m.content}`).join("\n\n");
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,tools:[{type:"web_search"}],tool_choice:"auto",include:["web_search_call.action.sources"],input:`INWAVE 광고 인사이트 카드뉴스 제작을 위해 아래 대화를 조사하세요. 공식 기관·연구·기업 자료를 우선하고 확인되지 않은 수치를 만들지 마세요. 핵심 사실, 광고주 관점의 의미, 출처명·연도·URL만 조사 메모로 작성하세요.\n\n${conversation}`})});
  const raw=await response.text(); let data; try{data=JSON.parse(raw)}catch{throw new Error("OpenAI 검색 응답을 읽지 못했습니다.")}
  if(!response.ok) throw new Error(data?.error?.message||`OpenAI 검색 오류 HTTP ${response.status}`);
  return {researchText:extractResponseText(data),sources:extractWebSources(data)};
}

const CLAUDE_SYSTEM=`당신은 INWAVE 인스타그램의 수석 크리에이티브 디렉터입니다. 회사소개가 아니라 광고주·대행사·매체 운영자가 멈추고 저장할 광고 인사이트 카드뉴스를 기획합니다.

[대화 및 완성 판단 엄격 규칙]
1. generateConfirmed가 false이면 어떤 경우에도 isComplete:true를 반환하지 않습니다.
2. 사용자가 "만들고 싶다", "제안해줘", "아이디어 줘", "어떻게 하면 좋을까"처럼 방향만 말한 것은 제작 승인으로 보지 않습니다.
3. 승인 전에는 3가지 주제 후보 또는 2~3가지 구성 방향을 제안하고, 가장 중요한 확인 질문 1~2개만 합니다.
4. 사용자가 후보를 골랐더라도 승인 전에는 선택한 방향을 짧게 요약하고 "이 내용으로 카드뉴스 제작을 시작할까요?"라고 확인합니다.
5. 기획 완성을 결정하는 주체는 사용자입니다. generateConfirmed가 true일 때만 storyboard와 게시글을 완성합니다.
6. generateConfirmed가 false일 때는 반드시 storyboard.pages=[]이며 instagramPost는 빈 값으로 반환합니다.

[완성 카드뉴스 규칙]
- 3~5장, 장표마다 반드시 새로운 정보.
- 1장은 photo-hook을 우선 사용. 2장 이후 모든 장표를 사진 배경으로 만들지 말고 big-number, metric-comparison, insight-cards, process-flow, photo-data-hybrid를 주제에 맞게 섞습니다.
- 최소 3종의 templateType을 사용합니다.
- photoRequirement가 none이면 englishImagePrompt는 빈 문자열이어야 합니다.
- 실제 사진이 메시지를 강화할 때만 required/optional을 사용합니다.
- 제목은 짧고 일상어로, 본문은 최대 2문장.
- 확인되지 않은 숫자를 만들지 않습니다. 연구 메모 밖의 사실은 단정하지 않습니다.
- INWAVE는 후반부에 실제 시청자 수, 시청시간, 시간대별 관심도, 소재별·위치별 성과 중 관련 항목만 자연스럽게 연결합니다.
- visualData는 코드 렌더링에 실제로 쓸 내용입니다. 비교형은 items 2개, 카드형은 2~4개, big-number는 primaryValue/primaryLabel을 채웁니다.
- 사진 프롬프트는 장표의 구체적 장소·행동·인물 수·구도·여백을 명시하고, 광고 맥락과 무관한 일반 사무실로 바꾸지 않습니다.
- 이미지 안의 글자, 로고, 워터마크는 요청하지 않습니다.`;

async function callClaudePlan(messages,researchContext,revision=null,generateConfirmed=false){
  if(!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 없습니다.");
  const model=revision?(process.env.ANTHROPIC_REVISION_MODEL||process.env.ANTHROPIC_CREATIVE_MODEL):(process.env.ANTHROPIC_CREATIVE_MODEL);
  if(!model) throw new Error("ANTHROPIC_CREATIVE_MODEL이 없습니다.");
  const userContent=[
    `대화:\n${messages.map(m=>`${m.role}: ${m.content}`).join("\n\n")}`,
    researchContext?`OpenAI 조사 메모:\n${researchContext.researchText}\n\n사용 가능한 출처 URL:\n${JSON.stringify(researchContext.sources,null,2)}`:"최신 조사 없이 사용자의 요청과 일반적 광고 실무 원칙만 사용하세요.",
    revision?`아래 기존 기획을 검수 지시대로 수정하세요. 지적되지 않은 좋은 부분은 유지하세요.\n기존 기획:\n${JSON.stringify(revision.plan,null,2)}\n검수 결과:\n${JSON.stringify(revision.review,null,2)}`:`제작 승인 상태: ${generateConfirmed ? "승인됨" : "승인되지 않음"}\n${generateConfirmed ? "사용자가 명확히 제작을 승인했습니다. 완성된 카드뉴스 JSON을 작성하세요." : "아직 제작하지 마세요. 주제 후보 또는 구성 방향을 제안하고 질문 1~2개만 하세요. isComplete=false, storyboard.pages=[]로 반환하세요."}`
  ].join("\n\n---\n\n");
  const response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model,max_tokens:12000,system:CLAUDE_SYSTEM,messages:[{role:"user",content:userContent}],tools:[{name:"submit_carousel_plan",description:"완성된 INWAVE 카드뉴스 기획을 지정 JSON 구조로 제출합니다.",input_schema:RESPONSE_SCHEMA}],tool_choice:{type:"tool",name:"submit_carousel_plan"}})});
  const raw=await response.text(); let data; try{data=JSON.parse(raw)}catch{throw new Error("Claude 응답을 읽지 못했습니다.")}
  if(!response.ok) throw new Error(data?.error?.message||`Claude API 오류 HTTP ${response.status}`);
  const tool=data?.content?.find(c=>c?.type==="tool_use"&&c?.name==="submit_carousel_plan");
  if(!tool?.input) throw new Error("Claude가 카드뉴스 JSON을 반환하지 않았습니다.");
  return tool.input;
}

async function reviewWithOpenAI(plan,researchContext){
  const model=process.env.OPENAI_REVIEW_MODEL||process.env.OPENAI_TEXT_MODEL;
  if(!model) throw new Error("OPENAI_REVIEW_MODEL 또는 OPENAI_TEXT_MODEL이 없습니다.");
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:"당신은 광고 카드뉴스 편집장입니다. 사실성, 광고주 관점, 장표 반복, 후킹력, 디자인 템플릿 다양성, 회사소개 느낌, INWAVE 연결의 자연스러움을 엄격히 검수하세요. 연구 메모에 없는 수치가 있으면 high로 지적하세요. 최소 3종 템플릿이 아니거나 2장 이후 사진형이 반복되면 지적하세요."},{role:"user",content:`연구 메모:\n${researchContext?.researchText||"없음"}\n\n기획:\n${JSON.stringify(plan,null,2)}`}],response_format:{type:"json_schema",json_schema:{name:"carousel_review",strict:true,schema:REVIEW_SCHEMA}}})});
  const raw=await response.text(); let data; try{data=JSON.parse(raw)}catch{throw new Error("OpenAI 검수 응답을 읽지 못했습니다.")}
  if(!response.ok) throw new Error(data?.error?.message||`OpenAI 검수 오류 HTTP ${response.status}`);
  return JSON.parse(stripCodeFence(data?.choices?.[0]?.message?.content||"{}"));
}

function normalizeResult(result,searchUsed){
  result.searchUsed=Boolean(searchUsed);
  result.projectTitle=String(result.projectTitle||"광고인사이트").replace(/[\\/:*?"<>|\s]+/g,"").slice(0,20)||"광고인사이트";
  result.chatReply=String(result.chatReply|| (result.isComplete?"카드뉴스 기획이 완료되었습니다.":"카드뉴스를 완성하기 위해 핵심 정보를 알려주세요."));
  if(!result.isComplete){result.storyboard={pages:[]};result.instagramPost={captions:{short:"",informative:"",conversational:""},cta:"",hashtags:[]};return result;}
  result.storyboard.pages=(result.storyboard?.pages||[]).slice(0,5).map((p,i)=>({
    ...p,pageNumber:i+1,templateType:TEMPLATE_TYPES.includes(p.templateType)?p.templateType:(i===0?"photo-hook":"insight-cards"),
    photoRequirement:["required","optional","none"].includes(p.photoRequirement)?p.photoRequirement:(i===0?"required":"none"),
    titleLines:Array.isArray(p.titleLines)&&p.titleLines.length?p.titleLines.slice(0,3):[p.title||""],bodyLines:Array.isArray(p.bodyLines)?p.bodyLines.slice(0,4):[],
    visualData:{eyebrow:p.visualData?.eyebrow||"",primaryValue:p.visualData?.primaryValue||"",primaryLabel:p.visualData?.primaryLabel||"",items:Array.isArray(p.visualData?.items)?p.visualData.items.slice(0,4):[],footerNote:p.visualData?.footerNote||""},
    sources:Array.isArray(p.sources)?p.sources.slice(0,4):[]
  }));
  return result;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  if(req.method!=="POST") return res.status(405).json({error:"POST 요청만 지원합니다."});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY가 없습니다."});
  const messages=safeMessages(req.body?.messages||[]); if(!messages.length)return res.status(400).json({error:"messages 배열이 필요합니다."});
  const generateConfirmed=req.body?.generateConfirmed===true;
  const searchUsed=needsWebSearch(messages);
  try{
    let researchContext=null;
    if(searchUsed){const model=process.env.OPENAI_SEARCH_MODEL||process.env.OPENAI_TEXT_MODEL;if(!model)throw new Error("OPENAI_SEARCH_MODEL 또는 OPENAI_TEXT_MODEL이 없습니다.");researchContext=await researchWithOpenAI(model,messages);}
    let plan=await callClaudePlan(messages,researchContext,null,generateConfirmed);
    plan=normalizeResult(plan,searchUsed);
    if(!generateConfirmed){
      plan.isComplete=false;
      plan.projectTitle="";
      plan.storyboard={pages:[]};
      plan.instagramPost={captions:{short:"",informative:"",conversational:""},cta:"",hashtags:[]};
      return res.status(200).json({...plan,requiresConfirmation:true});
    }
    if(plan.isComplete){
      const review=await reviewWithOpenAI(plan,researchContext);
      if(!review.pass && review.issues?.some(i=>i.severity==="high"||i.severity==="medium")){
        plan=normalizeResult(await callClaudePlan(messages,researchContext,{plan,review},true),searchUsed);
        plan.qualityReview={pass:false,overallScore:review.overallScore,summary:`1차 검수 후 Claude가 수정했습니다. ${review.summary}`};
      }else plan.qualityReview=review;
    }
    if(plan.isComplete && plan.storyboard.pages.length<3) throw new Error("완료된 카드뉴스는 최소 3장이어야 합니다.");
    return res.status(200).json(plan);
  }catch(error){console.error("plan-carousel 오류",error);return res.status(500).json({error:error instanceof Error?error.message:"기획 중 오류가 발생했습니다."});}
}
