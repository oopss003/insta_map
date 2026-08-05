/**
 * api/revise-carousel.js
 * OpenAI 검수에서 지적된 장표만 Claude가 수정합니다.
 */
export const maxDuration = 90;

const TEMPLATE_TYPES = ["photo-hook","editorial-photo","big-number","metric-comparison","insight-cards","process-flow","photo-data-hybrid","cta-minimal"];
const ROLES = ["hook","context","fact","misconception","observation","behavior","evidence","comparison","case","implication","insight","strategy","opportunity","solution","action","conclusion","cta"];
const ITEM_SCHEMA = { type:"object", additionalProperties:false, required:["label","value","note"], properties:{ label:{type:"string"}, value:{type:"string"}, note:{type:"string"} } };
const SOURCE_SCHEMA = { type:"object", additionalProperties:false, required:["claimType","sourceTitle","sourceOrganization","sourceYear","sourceUrl","sourceNote"], properties:{ claimType:{type:"string",enum:["researched_fact","case_reference","background_reference"]}, sourceTitle:{type:"string"}, sourceOrganization:{type:"string"}, sourceYear:{type:"string"}, sourceUrl:{type:"string"}, sourceNote:{type:"string"} } };
const PAGE_SCHEMA = { type:"object", additionalProperties:false, required:["pageNumber","role","templateType","photoRequirement","label","title","titleLines","body","bodyLines","koreanPromptSummary","englishImagePrompt","imageComposition","visualData","sources"], properties:{
  pageNumber:{type:"integer"}, role:{type:"string",enum:ROLES}, templateType:{type:"string",enum:TEMPLATE_TYPES}, photoRequirement:{type:"string",enum:["required","optional","none"]},
  label:{type:"string"}, title:{type:"string"}, titleLines:{type:"array",minItems:1,maxItems:3,items:{type:"string"}}, body:{type:"string"}, bodyLines:{type:"array",maxItems:4,items:{type:"string"}}, koreanPromptSummary:{type:"string"}, englishImagePrompt:{type:"string"},
  imageComposition:{type:"object",additionalProperties:false,required:["subjectPosition","reservedTextArea","cameraShot","backgroundDensity"],properties:{subjectPosition:{type:"string",enum:["left","left-center","center","right-center","right","upper","lower"]},reservedTextArea:{type:"string",enum:["upper-left","upper-center","upper-right","middle-left","middle-right","lower-left","lower-center","lower-right"]},cameraShot:{type:"string",enum:["close-up","medium","medium-wide","wide","over-the-shoulder","high-angle","low-angle"]},backgroundDensity:{type:"string",enum:["low","medium"]}}},
  visualData:{type:"object",additionalProperties:false,required:["eyebrow","primaryValue","primaryLabel","items","footerNote"],properties:{eyebrow:{type:"string"},primaryValue:{type:"string"},primaryLabel:{type:"string"},items:{type:"array",maxItems:4,items:ITEM_SCHEMA},footerNote:{type:"string"}}},
  sources:{type:"array",maxItems:4,items:SOURCE_SCHEMA}
} };
const RESPONSE_SCHEMA = { type:"object", additionalProperties:false, required:["isComplete","chatReply","searchUsed","projectTitle","storyboard","instagramPost"], properties:{
  isComplete:{type:"boolean"}, chatReply:{type:"string"}, searchUsed:{type:"boolean"}, projectTitle:{type:"string"},
  storyboard:{type:"object",additionalProperties:false,required:["pages"],properties:{pages:{type:"array",minItems:3,maxItems:5,items:PAGE_SCHEMA}}},
  instagramPost:{type:"object",additionalProperties:false,required:["captions","cta","hashtags"],properties:{captions:{type:"object",additionalProperties:false,required:["short","informative","conversational"],properties:{short:{type:"string"},informative:{type:"string"},conversational:{type:"string"}}},cta:{type:"string"},hashtags:{type:"array",maxItems:18,items:{type:"string"}}}}
} };

function normalize(result) {
  result.projectTitle = String(result.projectTitle || "광고인사이트").replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 20) || "광고인사이트";
  result.storyboard.pages = (result.storyboard?.pages || []).slice(0,5).map((p,i)=>({
    ...p, pageNumber:i+1,
    templateType:TEMPLATE_TYPES.includes(p.templateType)?p.templateType:(i===0?"photo-hook":"insight-cards"),
    photoRequirement:["required","optional","none"].includes(p.photoRequirement)?p.photoRequirement:(i===0?"required":"none"),
    titleLines:Array.isArray(p.titleLines)&&p.titleLines.length?p.titleLines.slice(0,3):[p.title||""],
    bodyLines:Array.isArray(p.bodyLines)?p.bodyLines.slice(0,4):[],
    visualData:{eyebrow:p.visualData?.eyebrow||"",primaryValue:p.visualData?.primaryValue||"",primaryLabel:p.visualData?.primaryLabel||"",items:Array.isArray(p.visualData?.items)?p.visualData.items.slice(0,4):[],footerNote:p.visualData?.footerNote||""},
    sources:Array.isArray(p.sources)?p.sources.slice(0,4):[]
  }));
  return result;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  if(req.method!=="POST") return res.status(405).json({error:"POST 요청만 지원합니다."});
  if(!process.env.ANTHROPIC_API_KEY) return res.status(500).json({error:"ANTHROPIC_API_KEY가 없습니다."});

  const { plan, review, researchContext=null } = req.body || {};
  if(!plan?.storyboard?.pages?.length) return res.status(400).json({error:"수정할 plan.storyboard.pages가 없습니다."});
  if(!review?.issues?.length) return res.status(200).json(plan);

  const model = process.env.ANTHROPIC_REVISION_MODEL || process.env.ANTHROPIC_CREATIVE_MODEL;
  if(!model) return res.status(500).json({error:"ANTHROPIC_REVISION_MODEL 또는 ANTHROPIC_CREATIVE_MODEL이 없습니다."});

  const system = `당신은 INWAVE 인스타그램 카드뉴스의 수석 크리에이티브 디렉터입니다.
OpenAI 편집장의 검수 지시를 반영해 카드뉴스를 수정합니다.
지적되지 않은 좋은 내용과 확인된 출처는 유지하고, 문제가 있는 장표만 최소한으로 수정합니다.
새로운 수치나 사실을 만들지 않습니다. 조사 메모에 없는 수치를 추가하지 않습니다.
1장은 강한 질문·비교·반전형 표지를 유지하고, 2장 이후에는 사진형만 반복하지 않습니다.
최소 3종의 templateType을 사용하고, photoRequirement=none이면 englishImagePrompt를 빈 문자열로 만듭니다.
회사소개나 기술 자랑이 아니라 광고주의 문제와 의사결정에 초점을 맞춥니다.`;

  try{
    const response = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},
      body:JSON.stringify({
        model,max_tokens:12000,temperature:0.25,system,
        messages:[{role:"user",content:`조사 메모:\n${researchContext?.researchText||"없음"}\n\n사용 가능한 출처:\n${JSON.stringify(researchContext?.sources||[],null,2)}\n\n기존 기획:\n${JSON.stringify(plan,null,2)}\n\nOpenAI 검수 결과:\n${JSON.stringify(review,null,2)}\n\n검수 지시를 반영한 전체 최종 기획을 제출하세요.`}],
        tools:[{name:"submit_revised_carousel",description:"검수를 반영한 전체 최종 카드뉴스 기획을 제출합니다.",input_schema:RESPONSE_SCHEMA}],
        tool_choice:{type:"tool",name:"submit_revised_carousel"}
      })
    });
    const raw=await response.text(); let data; try{data=JSON.parse(raw)}catch{throw new Error("Claude 수정 응답을 JSON으로 읽지 못했습니다.")}
    if(!response.ok) throw new Error(data?.error?.message||`Claude 수정 오류 HTTP ${response.status}`);
    const tool=data?.content?.find(c=>c?.type==="tool_use"&&c?.name==="submit_revised_carousel");
    if(!tool?.input) throw new Error("Claude가 수정된 카드뉴스 JSON을 반환하지 않았습니다.");
    return res.status(200).json(normalize(tool.input));
  }catch(error){
    console.error("revise-carousel 오류:",error);
    return res.status(500).json({error:error instanceof Error?error.message:"카드뉴스 수정 중 오류가 발생했습니다."});
  }
}
