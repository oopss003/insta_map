export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 사용할 수 있습니다."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY가 설정되지 않았습니다."
    });
  }

  const { message } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "정리할 주제를 입력해 주세요."
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content: `
너는 인스타그램 광고 콘텐츠 기획자다.

사용자의 설명을 분석해 반드시 JSON으로만 응답한다.

응답 형식:
{
  "topic": "콘텐츠 주제",
  "mainMessage": "핵심 메시지",
  "titles": [
    "제목 후보 1",
    "제목 후보 2",
    "제목 후보 3"
  ],
  "recommendedConcept": "hook 또는 insight 또는 magazine",
  "imagePrompt": "글자 없는 세로형 광고 이미지 생성용 영어 프롬프트"
}

컨셉 기준:
- hook: 강한 질문, 반전, 비교, 클릭 유도
- insight: 광고·마케팅 분석, 전문적이고 신뢰감 있는 분위기
- magazine: 감각적이고 세련된 트렌드 매거진 분위기

imagePrompt에는 반드시 다음 조건을 포함한다:
- vertical 4:5 composition
- no text
- no letters
- no logo
- space for Korean headline
`
            },
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI API 요청에 실패했습니다."
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "AI 응답 내용이 없습니다."
      });
    }

    const result = JSON.parse(content);

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "콘텐츠 기획 중 오류가 발생했습니다."
    });
  }
}
