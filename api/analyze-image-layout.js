function clampNumber(value, min, max, fallback) {
    const num = Number(value);

    if (Number.isNaN(num)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, num));
}

function normalizeAlign(value) {
    if (value === "left" || value === "center" || value === "right") {
        return value;
    }

    return "left";
}

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

    const {
        imageUrl,
        title = "",
        subtitle = "",
        concept = "hook"
    } = req.body || {};

    if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({
            error: "분석할 이미지 주소가 없습니다."
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
너는 인스타그램 광고 이미지 레이아웃 분석가다.

사용자가 고른 이미지를 보고 제목과 설명을 배치할 가장 적절한 위치를 추천한다.
사람 얼굴, 핵심 피사체, 제품 중심부를 피해야 한다.

반드시 아래 JSON 형식으로만 응답한다.
{
  "x": 8,
  "y": 58,
  "width": 70,
  "align": "left",
  "titleSize": 74,
  "subtitleSize": 34,
  "textColor": "#ffffff",
  "positionReason": "설명"
}

규칙:
- x: 3~55
- y: 5~78
- width: 38~84
- align: left / center / right
- titleSize: 58~86
- subtitleSize: 26~42
- textColor: #ffffff 또는 #000000
- 제목은 잘 보여야 하고 피사체를 최대한 가리지 말 것
`
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `
컨셉: ${concept}
제목: ${title}
설명: ${subtitle}

이 이미지에서 글씨를 자연스럽게 올릴 위치를 추천해줘.
`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageUrl
                                    }
                                }
                            ]
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
                    "이미지 레이아웃 분석에 실패했습니다."
            });
        }

        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            return res.status(500).json({
                error: "AI 분석 응답이 없습니다."
            });
        }

        const parsed = JSON.parse(content);

        return res.status(200).json({
            x: clampNumber(parsed.x, 3, 55, 8),
            y: clampNumber(parsed.y, 5, 78, 58),
            width: clampNumber(parsed.width, 38, 84, 70),
            align: normalizeAlign(parsed.align),
            titleSize: clampNumber(parsed.titleSize, 58, 86, 74),
            subtitleSize: clampNumber(parsed.subtitleSize, 26, 42, 34),
            textColor:
                parsed.textColor === "#000000" ? "#000000" : "#ffffff",
            positionReason:
                parsed.positionReason ||
                "피사체를 피하고 가독성이 좋은 위치에 배치했습니다."
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "이미지 레이아웃 분석 중 오류가 발생했습니다."
        });
    }
}
