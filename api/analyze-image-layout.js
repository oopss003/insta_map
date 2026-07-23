function clampNumber(value, min, max, fallback) {
    const num = Number(value);

    if (Number.isNaN(num)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, num));
}

function normalizeAlign(value) {
    if (
        value === "left" ||
        value === "center" ||
        value === "right"
    ) {
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

사용자가 제공한 이미지를 보고 제목과 설명을 자연스럽게 배치할 위치를 추천한다.
사람 얼굴, 핵심 제품, 중심 피사체를 최대한 가리지 말아야 한다.
글씨는 잘 보여야 하고, 너무 복잡한 배경은 피해야 한다.

반드시 아래 JSON 형식으로만 답한다:
{
  "x": 8,
  "y": 58,
  "width": 70,
  "align": "left",
  "titleSize": 72,
  "subtitleSize": 34,
  "textColor": "#ffffff",
  "positionReason": "추천 이유"
}

규칙:
- x, y, width는 퍼센트 값
- x 범위: 3~55
- y 범위: 5~75
- width 범위: 40~82
- align: left, center, right 중 하나
- titleSize: 56~84
- subtitleSize: 26~40
- textColor: #ffffff 또는 #000000
- 가급적 제목은 하단 또는 상단의 빈 공간에 배치
- 이미지의 핵심 피사체를 가리지 않기
- 한글 제목이 들어갈 수 있게 충분한 공간 확보
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

이 이미지에 제목과 설명을 자연스럽게 배치할 위치를 추천해줘.
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
                    "이미지 레이아웃 분석 요청에 실패했습니다."
            });
        }

        const content =
            data?.choices?.[0]?.message?.content;

        if (!content) {
            return res.status(500).json({
                error: "AI 응답 내용이 없습니다."
            });
        }

        const parsed = JSON.parse(content);

        const result = {
            x: clampNumber(parsed.x, 3, 55, 8),
            y: clampNumber(parsed.y, 5, 75, 58),
            width: clampNumber(
                parsed.width,
                40,
                82,
                70
            ),
            align: normalizeAlign(parsed.align),
            titleSize: clampNumber(
                parsed.titleSize,
                56,
                84,
                72
            ),
            subtitleSize: clampNumber(
                parsed.subtitleSize,
                26,
                40,
                34
            ),
            textColor:
                parsed.textColor === "#000000"
                    ? "#000000"
                    : "#ffffff",
            positionReason:
                parsed.positionReason ||
                "피사체를 피하고 가독성이 좋은 영역에 배치했습니다."
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error:
                "이미지 레이아웃 분석 중 오류가 발생했습니다."
        });
    }
}
