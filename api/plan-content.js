export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "POST 요청만 사용할 수 있습니다."
        });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
            error: "OPENAI_API_KEY가 설정되지 않았습니다."
        });
    }

    const { message } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
            error: "주제 내용이 없습니다."
        });
    }

    try {
        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
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

사용자가 입력한 내용을 바탕으로 아래 JSON만 반환한다.

{
  "mainMessage": "핵심 메시지",
  "titles": [
    "제목 후보 1",
    "제목 후보 2",
    "제목 후보 3"
  ],
  "imagePrompt": "이미지 생성용 영어 프롬프트",
  "recommendedConcept": "hook"
}

규칙:
- mainMessage는 1~2문장
- titles는 저장하고 싶은 광고 인사이트형 문장 3개
- imagePrompt는 실사형 이미지 생성 프롬프트
- recommendedConcept는 hook, insight, magazine 중 하나
- 이미지 프롬프트에는 'text, letters, watermark, logo 없음'도 반영
`
                        },
                        {
                            role: "user",
                            content: message.trim()
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
                    "OpenAI 요청에 실패했습니다."
            });
        }

        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            return res.status(500).json({
                error: "AI 응답이 비어 있습니다."
            });
        }

        const parsed = JSON.parse(content);

        return res.status(200).json({
            mainMessage:
                parsed.mainMessage ||
                "핵심 메시지를 생성하지 못했습니다.",
            titles:
                Array.isArray(parsed.titles) && parsed.titles.length > 0
                    ? parsed.titles
                    : [
                          "광고비는 나갔는데, 누가 봤는지는 아세요?",
                          "매체는 샀는데, 실제 시청은 확인하셨나요?",
                          "광고 집행 후 남는 건 숫자보다 시선일 수 있습니다."
                      ],
            imagePrompt:
                parsed.imagePrompt ||
                "Create a photorealistic advertising image for Instagram.",
            recommendedConcept:
                parsed.recommendedConcept || "hook"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "AI 기획 중 오류가 발생했습니다."
        });
    }
}
