/**
 * api/plan-carousel.js
 * OpenAI 구조화 조사 → Claude 기획 → OpenAI 검수 → Claude 부분 수정 → OpenAI 최종 재검수
 */
export const maxDuration = 180;

const TEMPLATE_TYPES = ["photo-hook","editorial-photo","big-number","metric-comparison","insight-cards","process-flow","photo-data-hybrid","cta-minimal"];
const ROLES = ["hook","context","fact","misconception","observation","behavior","evidence","comparison","case","implication","insight","strategy","opportunity","solution","action","conclusion","cta"];
const INFORMATION_TYPES = ["emotional-hook","statistic","comparison","misconception","explanation","case","action-tip","cta"];
const DESIGN_MODES = ["photo-heavy","hybrid","info-heavy"];
const PROFILE_FIELDS = ["speakerExpertise","speakerPersona","targetAudience","tone","contentGoal"];

function clean(value, max = 2000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/<[^>]*>/g, "").trim().slice(0, max);
}
function safeMessages(messages = []) {
  return messages.filter(m => m && ["user","assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-24).map(m => ({ role: m.role, content: clean(m.content, 8000) }));
}
function safeProfile(input = {}) {
  const profile = {
    speakerExpertise: clean(input.speakerExpertise, 180),
    speakerPersona: clean(input.speakerPersona, 180),
    targetAudience: clean(input.targetAudience, 220),
    tone: clean(input.tone, 180),
    contentGoal: clean(input.contentGoal, 240),
    brandName: clean(input.brandName, 120)
  };
  profile.missingFields = PROFILE_FIELDS.filter(key => !profile[key]);
  profile.isProfileComplete = profile.missingFields.length === 0;
  return profile;
}
function stripCodeFence(value = "") {
  return String(value).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
function extractResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) if (item?.type === "message") for (const c of item.content || []) if (c?.type === "output_text" && c.text) parts.push(c.text);
  return parts.join("\n\n").trim();
}
function extractWebSources(data) {
  const result = [], seen = new Set();
  const add = source => {
    const url = clean(source?.url || source?.link, 1000);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    result.push({ title: clean(source?.title || source?.name || "웹 자료", 300), url });
  };
  for (const item of data?.output || []) {
    if (item?.type === "web_search_call") (item?.action?.sources || item?.sources || []).forEach(add);
    if (item?.type === "message") for (const c of item.content || []) for (const a of c?.annotations || []) if (a?.type === "url_citation") add(a);
  }
  return result.slice(0, 24);
}

const CLAIM_SCHEMA = {type:"object",additionalProperties:false,required:["claimId","claim","evidence","researchCondition","audienceMeaning","recommendedAction","limitations","sourceOrganization","sourceTitle","sourceYear","sourceUrl"],properties:{
  claimId:{type:"string"},claim:{type:"string"},evidence:{type:"string"},researchCondition:{type:"string"},audienceMeaning:{type:"string"},recommendedAction:{type:"string"},limitations:{type:"string"},sourceOrganization:{type:"string"},sourceTitle:{type:"string"},sourceYear:{type:"string"},sourceUrl:{type:"string"}
}};
const RESEARCH_SCHEMA = {type:"object",additionalProperties:false,required:["topicSummary","claims"],properties:{topicSummary:{type:"string"},claims:{type:"array",minItems:4,maxItems:12,items:CLAIM_SCHEMA}}};
const PROFILE_SCHEMA = {type:"object",additionalProperties:false,required:["speakerExpertise","speakerPersona","targetAudience","tone","contentGoal","brandName","isProfileComplete","missingFields"],properties:{
  speakerExpertise:{type:"string"},speakerPersona:{type:"string"},targetAudience:{type:"string"},tone:{type:"string"},contentGoal:{type:"string"},brandName:{type:"string"},isProfileComplete:{type:"boolean"},missingFields:{type:"array",maxItems:6,items:{type:"string"}}
}};
const ITEM_SCHEMA = {type:"object",additionalProperties:false,required:["label","value","note"],properties:{label:{type:"string"},value:{type:"string"},note:{type:"string"}}};
const SOURCE_SCHEMA = {type:"object",additionalProperties:false,required:["claimType","sourceTitle","sourceOrganization","sourceYear","sourceUrl","sourceNote"],properties:{claimType:{type:"string",enum:["researched_fact","case_reference","background_reference","interpretation","recommendation"]},sourceTitle:{type:"string"},sourceOrganization:{type:"string"},sourceYear:{type:"string"},sourceUrl:{type:"string"},sourceNote:{type:"string"}}};
const PAGE_SCHEMA = {type:"object",additionalProperties:false,required:["pageNumber","role","informationType","designMode","templateType","templateReason","sceneValue","numericValue","comparisonValue","processValue","emotionValue","messageDensity","claimIds","photoRequirement","label","title","titleLines","body","bodyLines","koreanPromptSummary","englishImagePrompt","imageComposition","visualData","sources"],properties:{
  pageNumber:{type:"integer"},role:{type:"string",enum:ROLES},informationType:{type:"string",enum:INFORMATION_TYPES},designMode:{type:"string",enum:DESIGN_MODES},templateType:{type:"string",enum:TEMPLATE_TYPES},templateReason:{type:"string"},
  sceneValue:{type:"integer",minimum:0,maximum:100},numericValue:{type:"integer",minimum:0,maximum:100},comparisonValue:{type:"integer",minimum:0,maximum:100},processValue:{type:"integer",minimum:0,maximum:100},emotionValue:{type:"integer",minimum:0,maximum:100},messageDensity:{type:"string",enum:["low","medium","high"]},claimIds:{type:"array",maxItems:4,items:{type:"string"}},
  photoRequirement:{type:"string",enum:["required","optional","none"]},label:{type:"string"},title:{type:"string"},titleLines:{type:"array",minItems:1,maxItems:3,items:{type:"string"}},body:{type:"string"},bodyLines:{type:"array",maxItems:4,items:{type:"string"}},koreanPromptSummary:{type:"string"},englishImagePrompt:{type:"string"},
  imageComposition:{type:"object",additionalProperties:false,required:["subjectPosition","reservedTextArea","cameraShot","backgroundDensity"],properties:{subjectPosition:{type:"string",enum:["left","left-center","center","right-center","right","upper","lower"]},reservedTextArea:{type:"string",enum:["upper-left","upper-center","upper-right","middle-left","middle-right","lower-left","lower-center","lower-right"]},cameraShot:{type:"string",enum:["close-up","medium","medium-wide","wide","over-the-shoulder","high-angle","low-angle"]},backgroundDensity:{type:"string",enum:["low","medium"]}}},
  visualData:{type:"object",additionalProperties:false,required:["eyebrow","primaryValue","primaryLabel","items","footerNote"],properties:{eyebrow:{type:"string"},primaryValue:{type:"string"},primaryLabel:{type:"string"},items:{type:"array",maxItems:4,items:ITEM_SCHEMA},footerNote:{type:"string"}}},sources:{type:"array",maxItems:4,items:SOURCE_SCHEMA}
}};
const RESPONSE_SCHEMA = {type:"object",additionalProperties:false,required:["isComplete","chatReply","searchUsed","projectTitle","contentProfile","storyboard","instagramPost"],properties:{
  isComplete:{type:"boolean"},chatReply:{type:"string"},searchUsed:{type:"boolean"},projectTitle:{type:"string"},contentProfile:PROFILE_SCHEMA,
  storyboard:{type:"object",additionalProperties:false,required:["pages"],properties:{pages:{type:"array",minItems:0,maxItems:5,items:PAGE_SCHEMA}}},
  instagramPost:{type:"object",additionalProperties:false,required:["captions","cta","hashtags"],properties:{captions:{type:"object",additionalProperties:false,required:["short","informative","conversational"],properties:{short:{type:"string"},informative:{type:"string"},conversational:{type:"string"}}},cta:{type:"string"},hashtags:{type:"array",maxItems:18,items:{type:"string"}}}}
}};
const SCORE_NAMES = ["factScore","sourceQualityScore","noveltyScore","practicalityScore","flowScore","audienceValueScore","templateFitScore","imageNecessityScore","repetitionScore","saveShareValueScore"];
const REVIEW_SCHEMA = {type:"object",additionalProperties:false,required:["pass","overallScore",...SCORE_NAMES,"summary","issues"],properties:{
  pass:{type:"boolean"},overallScore:{type:"number"},factScore:{type:"number"},sourceQualityScore:{type:"number"},noveltyScore:{type:"number"},practicalityScore:{type:"number"},flowScore:{type:"number"},audienceValueScore:{type:"number"},templateFitScore:{type:"number"},imageNecessityScore:{type:"number"},repetitionScore:{type:"number"},saveShareValueScore:{type:"number"},summary:{type:"string"},issues:{type:"array",maxItems:12,items:{type:"object",additionalProperties:false,required:["pageNumber","severity","issue","instruction"],properties:{pageNumber:{type:"integer"},severity:{type:"string",enum:["low","medium","high"]},issue:{type:"string"},instruction:{type:"string"}}}}
}};

function profilePrompt(profile) {
  return `[확정/추출된 콘텐츠 프로필]\n화자 전문성: ${profile.speakerExpertise || "미확정"}\n화자 캐릭터: ${profile.speakerPersona || "미확정"}\n독자: ${profile.targetAudience || "미확정"}\n말투: ${profile.tone || "미확정"}\n목적: ${profile.contentGoal || "미확정"}\n브랜드: ${profile.brandName || "없음"}\n부족한 항목: ${profile.missingFields.join(", ") || "없음"}`;
}
const BASE_SYSTEM = `당신은 한국어 인스타그램 카드뉴스의 수석 콘텐츠 전략가이자 크리에이티브 디렉터입니다. 사용자의 대화에서 핵심 주제와 요구를 정확히 읽고, 독자가 멈추고 저장하며 실제 행동을 바꿀 수 있는 3~5장 카드뉴스를 설계합니다. 제목은 짧고 자연스럽게, 본문은 최대 2문장으로 씁니다. 한 장에는 하나의 핵심 주장만 배치하고 앞 장과 같은 말을 반복하지 않습니다.`;
const INWAVE_SYSTEM = `[INWAVE 전용 모드]\n화자는 INWAVE 광고 인사이트 담당자이고 독자는 광고주·대행사·매체 운영자입니다. 회사 소개가 아니라 오프라인 광고 의사결정에 도움 되는 인사이트가 중심입니다. 후반부에는 주제와 직접 관련 있을 때만 실제 시청자 수, 시청시간, 시간대별 관심도, 소재별·위치별 성과를 자연스럽게 연결합니다. 억지 홍보나 서비스 소개로 끝내지 않습니다.`;
const CUSTOM_SYSTEM = `[맞춤형 콘텐츠 모드]\n특정 회사, INWAVE, 광고 측정 서비스를 자동으로 언급하지 않습니다. 사용자의 요청에서 화자 전문성, 화자 캐릭터, 독자, 말투, 목적을 추출합니다. 이미 확인되는 정보는 다시 묻지 않고, 부족한 핵심 정보만 한 번에 최대 1~2개 질문합니다. 필수 프로필이 완성되기 전에는 storyboard를 만들지 않습니다. 말투만 바꾸지 말고 정보 깊이, 사례, 용어, 행동 제안을 독자 수준에 맞춥니다.`;
const CONTENT_QUALITY_RULES = `[정보 품질 규칙]\n- 최종 제작 시 제공된 claim 카드에 근거해 사실과 수치를 작성합니다. 출처 없는 수치를 만들지 않습니다.\n- 조사 조건이 다른 통계를 직접 비교하지 않습니다. 한계와 조건을 필요한 만큼 표시합니다.\n- 모든 수치·사실 장표는 claimIds를 하나 이상 연결합니다. 같은 claimId를 여러 정보 장표에서 반복 사용하지 않습니다.\n- 누구나 아는 일반론 대신 구체적 판단 기준, 오해 교정, 사례, 실무 행동을 우선합니다.\n- 기본 흐름은 통념/질문 → 근거 → 해석 → 바꿀 행동이며, 주제에 맞지 않으면 다른 흐름을 사용합니다.`;
const DESIGN_SELECTION_RULES = `[콘텐츠 기반 디자인 판단]\n- 각 장표를 쓰기 전에 informationType, sceneValue, numericValue, comparisonValue, processValue, emotionValue를 판단합니다.\n- 사진은 장면·행동·감정·공간 맥락이 정보 이해를 실제로 도울 때만 사용합니다. 장식용 사무실, 회의, 노트북 보는 사람 이미지를 금지합니다.\n- sceneValue/emotionValue가 높고 숫자 밀도가 낮으면 photo-hook 또는 editorial-photo를 고려합니다.\n- 장면과 숫자/근거가 모두 중요하면 photo-data-hybrid를 사용합니다.\n- 숫자가 중심이면 big-number, 비교가 중심이면 metric-comparison, 독립 요점은 insight-cards, 순서는 process-flow를 사용합니다.\n- 첫 장을 사진형으로 고정하지 않습니다. 가장 강한 후킹 형식을 선택합니다.\n- 최소 템플릿 종류를 억지로 채우지 말고 적합성을 우선합니다. 반복성은 검수합니다.\n- photoRequirement=none이면 englishImagePrompt와 koreanPromptSummary를 빈 문자열로 둡니다.\n- templateReason에 선택 이유를 구체적으로 씁니다.`;
function buildClaudeSystem(contentMode, profile) {
  return [BASE_SYSTEM, contentMode === "inwave" ? INWAVE_SYSTEM : CUSTOM_SYSTEM, contentMode === "custom" ? profilePrompt(profile) : "", CONTENT_QUALITY_RULES, DESIGN_SELECTION_RULES,
`[대화/완성 강제]\n1. generateConfirmed=false이면 isComplete=false, storyboard.pages=[]로 반환합니다.\n2. 방향 제안 요청은 제작 승인으로 보지 않습니다.\n3. 승인 전에는 후보 2~3개 또는 구성 방향을 제시하고 질문은 최대 2개만 합니다.\n4. custom 모드에서 프로필 미완성이면 승인 요청 버튼 단계로 넘어가지 않습니다.\n5. generateConfirmed=true이며 프로필 조건을 충족할 때만 완성합니다.`].join("\n\n");
}

async function researchWithOpenAI(model, messages, contentMode, profile) {
  const conversation = messages.map(m => `${m.role === "assistant" ? "AI" : "사용자"}: ${m.content}`).join("\n\n");
  const focus = contentMode === "inwave" ? "광고주·대행사·매체 운영자의 의사결정" : `${profile.targetAudience || "목표 독자"}에게 ${profile.contentGoal || "요청 목적"}을 달성시키는 데 필요한 정보`;
  const input = `아래 카드뉴스 대화를 웹 조사하세요. 공식기관, 원자료, 연구, 신뢰도 높은 기업 자료를 우선합니다. 단순 요약이 아니라 사용할 수 있는 주장 후보 8~12개를 구조화합니다. 각 주장에는 근거, 조사 대상·기간·표본·측정조건, 독자에게 주는 의미, 권장 행동, 한계, 기관명, 자료명, 연도, 원문 URL을 포함합니다. 일반론과 출처 불명 수치는 제외하고, 조건이 다른 통계는 직접 비교하지 마세요. 조사 초점: ${focus}.\n\n${profilePrompt(profile)}\n\n대화:\n${conversation}`;
  const response = await fetch("https://api.openai.com/v1/responses", {method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,tools:[{type:"web_search"}],tool_choice:"auto",include:["web_search_call.action.sources"],input,text:{format:{type:"json_schema",name:"carousel_research",strict:true,schema:RESEARCH_SCHEMA}}})});
  const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { throw new Error("OpenAI 검색 응답을 읽지 못했습니다."); }
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI 검색 오류 HTTP ${response.status}`);
  let research;
  try { research = JSON.parse(stripCodeFence(extractResponseText(data))); } catch { throw new Error("구조화된 조사 결과를 읽지 못했습니다."); }
  return { ...research, sources: extractWebSources(data) };
}

async function callClaudePlan(messages, researchContext, options) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 없습니다.");
  const { revision = null, generateConfirmed = false, contentMode, profile } = options;
  const model = revision ? (process.env.ANTHROPIC_REVISION_MODEL || process.env.ANTHROPIC_CREATIVE_MODEL) : process.env.ANTHROPIC_CREATIVE_MODEL;
  if (!model) throw new Error("ANTHROPIC_CREATIVE_MODEL이 없습니다.");
  const userContent = [
    `대화:\n${messages.map(m => `${m.role}: ${m.content}`).join("\n\n")}`,
    profilePrompt(profile),
    researchContext ? `사용 가능한 구조화 조사 claim:\n${JSON.stringify(researchContext, null, 2)}` : "아직 조사하지 않았습니다. 승인 전 대화에서는 조사 없이 프로필과 방향만 정리하세요.",
    revision ? `기존 기획을 아래 검수 지시에 따라 부분 수정하세요. 지적되지 않은 좋은 부분은 유지하세요.\n기존 기획:\n${JSON.stringify(revision.plan, null, 2)}\n검수:\n${JSON.stringify(revision.review, null, 2)}` : `제작 승인: ${generateConfirmed ? "승인됨" : "승인되지 않음"}. ${generateConfirmed ? "완성 JSON을 작성하세요." : "아직 storyboard를 만들지 말고 방향 제안 또는 필요한 질문만 하세요."}`
  ].join("\n\n---\n\n");
  const response = await fetch("https://api.anthropic.com/v1/messages", {method:"POST",headers:{"x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model,max_tokens:16000,system:buildClaudeSystem(contentMode, profile),messages:[{role:"user",content:userContent}],tools:[{name:"submit_carousel_plan",description:"카드뉴스 대화 결과 또는 완성 기획을 지정 JSON으로 제출합니다.",input_schema:RESPONSE_SCHEMA}],tool_choice:{type:"tool",name:"submit_carousel_plan"}})});
  const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { throw new Error("Claude 응답을 읽지 못했습니다."); }
  if (!response.ok) throw new Error(data?.error?.message || `Claude API 오류 HTTP ${response.status}`);
  const tool = data?.content?.find(c => c?.type === "tool_use" && c?.name === "submit_carousel_plan");
  if (!tool?.input) throw new Error("Claude가 카드뉴스 JSON을 반환하지 않았습니다.");
  return tool.input;
}

async function reviewWithOpenAI(plan, researchContext, contentMode, profile, stage = "1차") {
  const model = process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_TEXT_MODEL;
  if (!model) throw new Error("OPENAI_REVIEW_MODEL 또는 OPENAI_TEXT_MODEL이 없습니다.");
  const system = `당신은 카드뉴스 편집장입니다. ${stage} 검수를 합니다. 사실성, 출처 품질, 새로움, 실무성, 흐름, 목표 독자 가치, 템플릿 적합성, 사진 필요성, 반복성, 저장·공유 가치를 각각 0~100점으로 평가하세요. high 이슈가 없고 overallScore 85 이상이며 noveltyScore, practicalityScore, templateFitScore가 모두 75 이상일 때만 pass=true입니다. 사진형 개수나 템플릿 종류를 기계적으로 강제하지 말고 정보 적합성을 평가하세요. custom 모드에서는 INWAVE가 불필요하게 등장하면 high, 프로필과 말투·정보 깊이가 불일치하면 지적하세요.`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:0.1,messages:[{role:"system",content:system},{role:"user",content:`모드: ${contentMode}\n프로필: ${JSON.stringify(profile)}\n구조화 조사: ${JSON.stringify(researchContext)}\n기획: ${JSON.stringify(plan)}`}],response_format:{type:"json_schema",json_schema:{name:"carousel_review",strict:true,schema:REVIEW_SCHEMA}}})});
  const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { throw new Error("OpenAI 검수 응답을 읽지 못했습니다."); }
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI 검수 오류 HTTP ${response.status}`);
  return JSON.parse(stripCodeFence(data?.choices?.[0]?.message?.content || "{}"));
}

function defaultPost() { return { captions:{short:"",informative:"",conversational:""}, cta:"", hashtags:[] }; }

function parseJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;
  const text = stripCodeFence(value).trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeResult(result, options) {
  const { searchUsed, contentMode, requestedProfile, generateConfirmed } = options;
  result = parseJsonObject(result, {});
  result.contentProfile = parseJsonObject(result.contentProfile, {});
  result.storyboard = parseJsonObject(result.storyboard, { pages: [] });
  result.instagramPost = parseJsonObject(result.instagramPost, defaultPost());
  if (typeof result.storyboard.pages === "string") {
    try { result.storyboard.pages = JSON.parse(stripCodeFence(result.storyboard.pages)); }
    catch { result.storyboard.pages = []; }
  }
  if (!Array.isArray(result.storyboard.pages)) result.storyboard.pages = [];
  const mergedProfile = safeProfile({ ...requestedProfile, ...(contentMode === "custom" ? result.contentProfile : {}) });
  if (contentMode === "inwave") mergedProfile.isProfileComplete = true, mergedProfile.missingFields = [];
  result.contentProfile = mergedProfile;
  result.searchUsed = Boolean(searchUsed);
  result.projectTitle = clean(result.projectTitle || "카드뉴스", 40).replace(/[\\/:*?"<>|\s]+/g, "").slice(0, 24) || "카드뉴스";
  result.chatReply = clean(result.chatReply || (result.isComplete ? "카드뉴스 기획이 완료되었습니다." : "기획에 필요한 내용을 확인하겠습니다."), 4000);
  const canGenerate = generateConfirmed === true && (contentMode === "inwave" || mergedProfile.isProfileComplete === true);
  if (!canGenerate || !result.isComplete) {
    result.isComplete = false;
    result.projectTitle = "";
    result.storyboard = { pages: [] };
    result.instagramPost = defaultPost();
    return result;
  }
  const usedClaims = new Set();
  result.storyboard = result.storyboard || { pages:[] };
  result.storyboard.pages = (result.storyboard.pages || []).slice(0, 5).map((p, i) => {
    const informationType = INFORMATION_TYPES.includes(p.informationType) ? p.informationType : (i === 0 ? "emotional-hook" : "explanation");
    const designMode = DESIGN_MODES.includes(p.designMode) ? p.designMode : "info-heavy";
    let templateType = TEMPLATE_TYPES.includes(p.templateType) ? p.templateType : "insight-cards";
    let photoRequirement = ["required","optional","none"].includes(p.photoRequirement) ? p.photoRequirement : (["photo-hook","editorial-photo","photo-data-hybrid"].includes(templateType) ? "required" : "none");
    if (designMode === "info-heavy" && !["photo-data-hybrid"].includes(templateType)) photoRequirement = "none";
    const claimIds = Array.isArray(p.claimIds) ? p.claimIds.map(x => clean(x, 30)).filter(Boolean).filter(id => { if (usedClaims.has(id)) return false; usedClaims.add(id); return true; }).slice(0, 4) : [];
    const noPhoto = photoRequirement === "none";
    return {
      ...p, pageNumber:i+1, informationType, designMode, templateType, photoRequirement, claimIds,
      templateReason:clean(p.templateReason, 500),sceneValue:Math.max(0,Math.min(100,Number(p.sceneValue)||0)),numericValue:Math.max(0,Math.min(100,Number(p.numericValue)||0)),comparisonValue:Math.max(0,Math.min(100,Number(p.comparisonValue)||0)),processValue:Math.max(0,Math.min(100,Number(p.processValue)||0)),emotionValue:Math.max(0,Math.min(100,Number(p.emotionValue)||0)),messageDensity:["low","medium","high"].includes(p.messageDensity)?p.messageDensity:"medium",
      titleLines:Array.isArray(p.titleLines)&&p.titleLines.length?p.titleLines.slice(0,3):[clean(p.title,500)],bodyLines:Array.isArray(p.bodyLines)?p.bodyLines.slice(0,4):[],koreanPromptSummary:noPhoto?"":clean(p.koreanPromptSummary,1000),englishImagePrompt:noPhoto?"":clean(p.englishImagePrompt,5000),
      visualData:{eyebrow:clean(p.visualData?.eyebrow,200),primaryValue:clean(p.visualData?.primaryValue,200),primaryLabel:clean(p.visualData?.primaryLabel,300),items:Array.isArray(p.visualData?.items)?p.visualData.items.slice(0,4):[],footerNote:clean(p.visualData?.footerNote,500)},sources:Array.isArray(p.sources)?p.sources.slice(0,4):[]
    };
  });
  result.instagramPost = result.instagramPost || defaultPost();
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error:"POST 요청만 지원합니다." });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error:"OPENAI_API_KEY가 없습니다." });
  const messages = safeMessages(req.body?.messages || []);
  if (!messages.length) return res.status(400).json({ error:"messages 배열이 필요합니다." });
  const generateConfirmed = req.body?.generateConfirmed === true;
  const contentMode = req.body?.contentMode === "custom" ? "custom" : "inwave";
  const requestedProfile = contentMode === "custom" ? safeProfile(req.body?.contentProfile || {}) : safeProfile({});
  const reusableResearch = req.body?.researchContext && typeof req.body.researchContext === "object" ? req.body.researchContext : null;
  try {
    let researchContext = reusableResearch;
    let searchUsed = Boolean(researchContext);
    if (generateConfirmed && !researchContext) {
      const model = process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_TEXT_MODEL;
      if (!model) throw new Error("OPENAI_SEARCH_MODEL 또는 OPENAI_TEXT_MODEL이 없습니다.");
      researchContext = await researchWithOpenAI(model, messages, contentMode, requestedProfile);
      searchUsed = true;
    }
    let plan = await callClaudePlan(messages, researchContext, { generateConfirmed, contentMode, profile:requestedProfile });
    plan = normalizeResult(plan, { searchUsed, contentMode, requestedProfile, generateConfirmed });
    const canConfirm = contentMode === "inwave" || plan.contentProfile.isProfileComplete;
    if (!generateConfirmed || !canConfirm) {
      return res.status(200).json({ ...plan, researchContext, requiresConfirmation:canConfirm });
    }
    if (plan.isComplete) {
      const firstReview = await reviewWithOpenAI(plan, researchContext, contentMode, plan.contentProfile, "1차");
      let finalReview = firstReview;
      let revisionApplied = false;
      if (!firstReview.pass) {
        plan = normalizeResult(await callClaudePlan(messages, researchContext, { revision:{plan,review:firstReview}, generateConfirmed:true, contentMode, profile:plan.contentProfile }), { searchUsed, contentMode, requestedProfile:plan.contentProfile, generateConfirmed:true });
        revisionApplied = true;
        finalReview = await reviewWithOpenAI(plan, researchContext, contentMode, plan.contentProfile, "최종");
      }
      plan.qualityReview = { ...finalReview, revisionApplied, firstReview };
    }
    if (plan.isComplete && plan.storyboard.pages.length < 3) throw new Error("완료된 카드뉴스는 최소 3장이어야 합니다.");
    return res.status(200).json({ ...plan, researchContext, requiresConfirmation:false });
  } catch (error) {
    console.error("plan-carousel 오류", error);
    return res.status(500).json({ error:error instanceof Error ? error.message : "기획 중 오류가 발생했습니다." });
  }
}

