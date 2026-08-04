const SYSTEM_PROMPT = `
당신은 INWAVE 인스타그램 카드뉴스 기획자다.
INWAVE 계정은 회사소개 계정이 아니라 광고주·광고대행사·매체 운영자가 저장하는 광고 인사이트 계정이다.

반드시 다음 규칙을 따른다.
1. 3~5장으로 구성한다. 기본은 4장이다.
2. 1장은 cover이며 질문·숫자·비교·반전으로 클릭을 유도한다.
3. 2장은 광고주의 문제나 현상을 explain, compare, process 중 적합한 것으로 설명한다.
4. 3장은 저장 가치가 있는 실무 인사이트다. 실제 숫자가 있으면 number, table, bar-chart, line-chart를 판단하고, 숫자가 없으면 compare, checklist, process를 사용한다.
5. 4장은 solution 또는 checklist로 시청자 수, 시청시간, 시간대, 위치, 소재 성과 등 데이터 기반 의사결정과 연결한다.
6. 5장은 필요할 때만 cta로 쓴다.
7. 실제 근거가 없는 숫자를 절대 만들지 않는다. 숫자가 없으면 그래프를 만들지 않는다.
8. cover는 한 게시물에서 한 장만 사용한다.
9. 전체 사진 배경은 최대 두 장이며, 표·그래프·체크리스트 장은 사진을 사용하지 않는다.
10. 같은 layoutType을 연속으로 사용하지 않는다.
11. 제목은 짧고 쉬운 한국어 1~2줄, 본문은 2~4줄이다.
12. 혁신, 최첨단, 패러다임, 독보적 기술 같은 추상적 표현을 피한다.
13. INWAVE는 후반부에서 광고주의 의사결정을 돕는 방법으로 자연스럽게 등장한다.
14. 오렌지 라벨은 제목을 반복하지 않고 장의 역할을 최대 12자로 안내한다.
15. dataJson은 해당 layoutType 렌더러가 사용할 JSON 문자열이다.

dataJson 형식:
- compare: {"leftTitle":"","leftDescription":"","rightTitle":"","rightDescription":""}
- number: {"value":"", "unit":""}
- table: {"headers":["","",""],"rows":[["","",""]]}
- bar-chart/line-chart: {"items":[{"label":"","value":0}],"unit":""}
- process: {"items":["","",""]}
- checklist: {"items":["","",""]}
- solution: {"metrics":["","",""]}
- cover/explain/quote-insight/cta: {}

imageNeeded는 cover에서 true가 기본이고, 나머지는 메시지 강화에 꼭 필요할 때만 true다.
imagePrompt에는 텍스트, 로고, 얼굴인식 박스, AI 회로, 로봇을 넣지 말고 실제 광고 현장 중심의 세로 4:5 사진 프롬프트를 작성한다.
`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["contentTitle","pageCount","overallTone","pages"],
  properties: {
    contentTitle: {type:"string"},
    pageCount: {type:"integer",minimum:3,maximum:5},
    overallTone: {type:"string"},
    pages: {
      type:"array",minItems:3,maxItems:5,
      items:{
        type:"object",additionalProperties:false,
        required:["pageNumber","role","layoutType","label","showLabel","title","body","visualType","imageNeeded","imagePrompt","dataJson","reason"],
        properties:{
          pageNumber:{type:"integer"},
          role:{type:"string"},
          layoutType:{type:"string",enum:["cover","explain","number","compare","table","bar-chart","line-chart","process","checklist","quote-insight","solution","cta"]},
          label:{type:"string"},
          showLabel:{type:"boolean"},
          title:{type:"string"},
          body:{type:"string"},
          visualType:{type:"string"},
          imageNeeded:{type:"boolean"},
          imagePrompt:{type:"string"},
          dataJson:{type:"string"},
          reason:{type:"string"}
        }
      }
    }
  }
};

function outputText(data){
  if (typeof data.output_text === "string") return data.output_text;
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

module.exports = async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST 요청만 지원합니다."});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY가 설정되지 않았습니다."});

  const {topic,facts="",pageCount="auto",labelMode="ai",fixedLabel=""}=req.body||{};
  if(!topic) return res.status(400).json({error:"topic이 필요합니다."});

  const userPrompt = `
주제: ${topic}
참고 데이터 또는 필수 내용: ${facts || "없음"}
장수: ${pageCount}
라벨 방식: ${labelMode}
고정 라벨: ${fixedLabel || "없음"}

라벨 방식 처리:
- ai: 장별 역할에 맞게 서로 다른 라벨 생성
- fixed: 모든 장 label을 고정 라벨로 설정
- hidden: showLabel=false, label=""

장수가 숫자로 지정되면 정확히 그 장수로 구성하고, auto이면 3~5장 중 가장 적합하게 결정하라.
`;

  try{
    const response = await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions:SYSTEM_PROMPT,
        input:userPrompt,
        text:{
          format:{
            type:"json_schema",
            name:"inwave_carousel_plan",
            strict:true,
            schema
          }
        }
      })
    });
    const data=await response.json();
    if(!response.ok) return res.status(response.status).json({error:data.error?.message||"OpenAI 요청 실패"});
    const text=outputText(data);
    if(!text) return res.status(500).json({error:"AI 응답에서 구조화된 결과를 찾지 못했습니다."});
    return res.status(200).json(JSON.parse(text));
  }catch(error){
    console.error(error);
    return res.status(500).json({error:error.message||"서버 오류"});
  }
};
