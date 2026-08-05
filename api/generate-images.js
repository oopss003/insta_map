/**
 * api/generate-images.js
 * 사진이 필요한 장표만 FAL/Replicate로 생성합니다.
 */
export const maxDuration = 300;
import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY });

const CONCEPTS={
  hook:"High-impact editorial advertising photography, immediate thumbnail clarity, one unmistakable subject, realistic dramatic lighting.",
  insight:"Credible documentary advertising photography, analytical and professional, natural navy ivory and warm orange accents.",
  magazine:"Premium contemporary magazine photography, refined cinematic realism, natural texture and subtle visual tension."
};
function count(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(2,Math.floor(n))):0}
function clean(v,max=10000){return String(v||"").replace(/\u0000/g,"").trim().slice(0,max)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function imageResult(provider,url,index){return{id:`${provider}-${Date.now()}-${index}`,provider,imageUrl:url}}

function compositionInstruction(c={},role="insight"){
  const area=c.reservedTextArea||"lower-left";
  const subject=c.subjectPosition||"right-center";
  const shot=c.cameraShot||"medium-wide";
  return `Camera: ${shot}. Place the primary subject at ${subject}. Keep the ${area} region calm and low-detail for Korean text added later. Keep faces, hands, products and key actions outside that area.`;
}
function buildPrompt(prompt,concept,imageComposition,role){
  const scene=clean(prompt);
  const style=CONCEPTS[concept]||CONCEPTS.hook;
  return `${scene}

${style}
${compositionInstruction(imageComposition,role)}

Requirements:
- vertical 4:5 Instagram image
- photorealistic editorial or documentary photograph
- one coherent scene with a clear advertising or consumer-behavior message
- realistic people, hands, architecture and lighting
- no generic office unless explicitly requested
- no infographic, chart, collage, split screen or poster layout
- no readable text, pseudo-text, numbers, logos, watermark or UI overlay
- screens, signs and papers may exist only when blank, turned away or naturally blurred
- preserve the requested location, action, camera angle and negative space`.trim();
}

async function generateFal(prompt,n){
  if(!n)return[];
  if(!process.env.FAL_KEY)throw new Error("FAL_KEY가 없습니다.");
  const model=process.env.FAL_MODEL?.trim()||"fal-ai/flux/dev";
  const result=await fal.subscribe(model,{input:{prompt,image_size:{width:1080,height:1350},num_images:n,num_inference_steps:32,guidance_scale:3.8,enable_safety_checker:true,output_format:"png"},logs:true});
  const raw=result?.data?.images;
  if(!Array.isArray(raw))throw new Error("FAL 응답에 images 배열이 없습니다.");
  return raw.map((x,i)=>imageResult("fal",typeof x==="string"?x:x?.url,i)).filter(x=>/^https?:\/\//.test(x.imageUrl||""));
}
function parseReplicateModel(value){
  const model=clean(value||"black-forest-labs/flux-schnell",300);
  if(/^[a-f0-9]{64}$/i.test(model))return{type:"version",version:model};
  const [path,version]=model.split(":");
  if(version&&/^[a-f0-9]{64}$/i.test(version))return{type:"version",version};
  const [owner,name]=path.split("/");return{type:"official",owner:owner||"black-forest-labs",name:name||"flux-schnell"};
}
async function createPrediction(info,prompt){
  const endpoint=info.type==="version"?"https://api.replicate.com/v1/predictions":`https://api.replicate.com/v1/models/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.name)}/predictions`;
  const body=info.type==="version"?{version:info.version,input:{prompt,aspect_ratio:"4:5",output_format:"png"}}:{input:{prompt,aspect_ratio:"4:5",output_format:"png"}};
  const r=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${process.env.REPLICATE_API_TOKEN}`,"Content-Type":"application/json",Prefer:"wait=60"},body:JSON.stringify(body)});
  const raw=await r.text();let d;try{d=JSON.parse(raw)}catch{throw new Error("Replicate 응답을 읽지 못했습니다.")};if(!r.ok)throw new Error(d?.detail||d?.error||`Replicate 오류 HTTP ${r.status}`);return d;
}
async function waitPrediction(p){
  let cur=p;for(let i=0;i<20;i++){if(cur?.status==="succeeded")return cur;if(["failed","canceled"].includes(cur?.status))throw new Error(cur?.error||`Replicate ${cur.status}`);if(!cur?.urls?.get)break;await sleep(5000);const r=await fetch(cur.urls.get,{headers:{Authorization:`Bearer ${process.env.REPLICATE_API_TOKEN}`}});cur=await r.json();}throw new Error("Replicate 생성 대기 시간이 초과됐습니다.");
}
function urls(output){if(typeof output==="string")return[output];if(Array.isArray(output))return output.filter(x=>typeof x==="string");if(output&&typeof output==="object")return[output.url,output.image,output.imageUrl,output.output].filter(x=>typeof x==="string");return[]}
async function generateReplicate(prompt,n){
  if(!n)return[];if(!process.env.REPLICATE_API_TOKEN)throw new Error("REPLICATE_API_TOKEN이 없습니다.");const info=parseReplicateModel(process.env.REPLICATE_MODEL);const out=[];
  for(let i=0;i<n;i++){let p=await createPrediction(info,prompt);if(["starting","processing"].includes(p?.status))p=await waitPrediction(p);urls(p?.output).filter(u=>/^https?:\/\//.test(u)).forEach((u,j)=>out.push(imageResult("replicate",u,`${i}-${j}`)));}
  return out;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST 요청만 지원합니다."});
  const {prompt,concept="hook",providers={},imageComposition={},role="insight",photoRequirement="required",templateType="photo-hook"}=req.body||{};
  if(photoRequirement==="none")return res.status(400).json({error:"이 장표는 코드 기반 디자인 장표라 사진 생성이 필요하지 않습니다."});
  if(!["photo-hook","editorial-photo","photo-data-hybrid"].includes(templateType)&&photoRequirement!=="required")return res.status(400).json({error:"현재 템플릿은 사진 생성 대상이 아닙니다."});
  const source=clean(prompt);if(!source)return res.status(400).json({error:"이미지 프롬프트가 없습니다."});
  const normalized={fal:count(providers.fal),replicate:count(providers.replicate)};if(normalized.fal+normalized.replicate<1)return res.status(400).json({error:"이미지를 1장 이상 선택하세요."});
  const finalPrompt=buildPrompt(source,concept,imageComposition,role);const images=[],providerErrors=[];const jobs=[];
  if(normalized.fal)jobs.push(generateFal(finalPrompt,normalized.fal).then(x=>images.push(...x)).catch(e=>providerErrors.push({provider:"fal",message:e.message})));
  if(normalized.replicate)jobs.push(generateReplicate(finalPrompt,normalized.replicate).then(x=>images.push(...x)).catch(e=>providerErrors.push({provider:"replicate",message:e.message})));
  await Promise.all(jobs);
  if(!images.length)return res.status(500).json({error:"생성된 이미지가 없습니다.",providerErrors});
  return res.status(200).json({success:true,images,providerErrors,finalPrompt});
}
