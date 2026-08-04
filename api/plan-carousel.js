module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });
  }

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 배열이 필요합니다." });
  }

  const SYSTEM_PROMPT = `
당신은 INWAVE의 수석 콘텐츠 기획자입니다. 
광고주와 매체 운영자를 설득하기 위한 인스타그램 다장표(Carousel) 카드뉴스를 기획합니다.
사용자와 대화하며 아래 3가지 필수 요소를 파악하세요.
1. 핵심 타겟 (광고주 vs 매체사)
2. 강조할 문제점 및 솔루션 (예: 비용 낭비, 시청 데이터 부족 등)
3. 원하는 톤앤매너

[대화 및 기획 규칙]
- 정보가 부족하면 'isComplete: false'로 설정하고 친절하게 다음 질문을 던져 대화를 이어갑니다 (chatReply 작성).
- 충분한 정보가 모였다고 판단되거나 사용자가 '이대로 진행해줘'라고 하면 'isComplete: true'로 설정하고 스토리보드를 기획합니다.
- 스토리보드는 2~4장으로 구성하며, 각 장의 역할(표지, 문제, 해결, CTA)이 이어지도록 작성합니다.
- 각 장의 'label'은 내용에 맞게 '광고 인사이트', '문제 원인', '데이터 분석', '해결책' 등으로 커스텀합니다.
- **가장 중요한 이미지 프롬프트(englishImagePrompt)**: 실제 사진가가 찍은 듯한 고품질 사진 생성을 위해 구체적인 피사체, 상황, 4:5 비율, 텍스트 금지(NO text, NO logos) 등의 조건을 포함한 상세한 '영문' 프롬프트를 작성합니다.
- 사용자를 위한 요약 프롬프트(koreanPromptSummary)는 한국어 1문장으로 작성합니다.
`;

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["isComplete", "chatReply", "storyboard"],
    properties: {
      isComplete: { 
        type: "boolean", 
        description: "기획에 필요한 정보가 모두 모였거나 사용자가 기획을 확정했는지 여부" 
      },
      chatReply: { 
        type: "string", 
        description: "사용자에게 응답할 대화 메시지 (isComplete가 false일 때 주로 사용)" 
      },
      storyboard: {
        type: "object",
        additionalProperties: false,
        nullable: true,
        required: ["pages"],
        properties: {
          pages: {
            type: "array",
            description: "카드뉴스 장표 리스트 (2~4장)",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["pageNumber", "role", "label", "title", "body", "koreanPromptSummary", "englishImagePrompt"],
              properties: {
                pageNumber: { type: "integer" },
                role: { type: "string", description: "hook, problem, solution, cta 등" },
                label: { type: "string", description: "장표 상단 오렌지 라벨 (최대 10자)" },
                title: { type: "string", description: "장표 제목 (짧고 강렬하게)" },
                body: { type: "string", description: "장표 본문 설명" },
                koreanPromptSummary: { type: "string", description: "사용자 확인용 한국어 이미지 묘사" },
                englishImagePrompt: { type: "string", description: "AI 이미지 생성용 고품질 상세 영문 프롬프트 (NO text 포함)" }
              }
            }
          }
        }
      }
    }
  };

  try {
    const apiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: apiMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "inwave_storyboard_planner",
            strict: true,
            schema: schema
          }
        },
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "OpenAI API 에러" });
    }

    const resultText = data.choices[0].message.content;
    return res.status(200).json(JSON.parse(resultText));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "서버 내부 오류" });
  }
};
