/**
 * api/analyze-layout.js
 *
 * 이미지의 핵심 피사체를 피해서
 * 텍스트 위치를 추천하는 OpenAI 비전 API
 */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 지원합니다."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY가 설정되지 않았습니다."
    });
  }

  const { imageDataUrl, page, currentLayout, canvas } = req.body || {};

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return res.status(400).json({
      error: "imageDataUrl이 필요합니다."
    });
  }

  const safePage = {
    label: String(page?.label || "").slice(0, 200),
    title: String(page?.title || "").slice(0, 500),
    body: String(page?.body || "").slice(0, 1000)
  };

  const safeCurrentLayout = {
    width: Number(currentLayout?.width) || 70,
    titleSize: Number(currentLayout?.titleSize) || 74,
    subtitleSize: Number(currentLayout?.subtitleSize) || 34,
    align: String(currentLayout?.align || "left")
  };

  const safeCanvas = {
    width: Number(canvas?.width) || 1080,
    height: Number(canvas?.height) || 1350
  };

  const model =
    process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini";

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["recommendedPosition", "reason", "avoidAreas"],
    properties: {
      recommendedPosition: {
        type: "object",
        additionalProperties: false,
        required: ["x", "y", "align"],
        properties: {
          x: {
            type: "number",
            description: "텍스트 블록 시작 x 위치(퍼센트, 0~100)"
          },
          y: {
            type: "number",
            description: "텍스트 블록 시작 y 위치(퍼센트, 0~100)"
          },
          align: {
            type: "string",
            enum: ["left", "center", "right"]
          }
        }
      },
      reason: {
        type: "string",
        description: "추천 이유를 1~2문장으로 간단히 설명"
      },
      avoidAreas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["x", "y", "width", "height", "reason"],
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            reason: { type: "string" }
          }
        }
      }
    }
  };

  const systemPrompt = `
당신은 카드뉴스 텍스트 레이아웃 전문가입니다.

사용자는 4:5 세로형 이미지 위에
한국어 텍스트 블록(라벨 + 제목 + 본문)을 올릴 예정입니다.

목표:
- 텍스트가 잘 읽히는 위치를 추천
- 핵심 피사체(인물 얼굴, 손, 휴대폰, 제품, 화면, 중요한 물체)를 가리지 않기
- 너무 복잡한 배경 위를 피하기
- 제목이 잘 보일 수 있는 여백을 우선 찾기
- 카드뉴스 표지답게 시선이 분산되지 않는 위치 추천

중요:
- x, y는 퍼센트 단위이며 0~100 범위
- 사용자의 텍스트 박스 width는 고정에 가깝다고 보고, x/y/align만 추천
- 현재 시스템에서는 width를 별도로 바꾸지 않으므로 x는 너비를 고려해 과도하게 오른쪽/왼쪽으로 밀지 말 것
- 텍스트 블록은 일반적으로 화면 아래 또는 옆의 비교적 정돈된 영역에 배치하는 것이 좋음
- 핵심 피사체를 가리지 마세요
- 휴대폰 화면, 얼굴, 제품 중심부 위는 피하세요
- 추천 좌표는 실제 사용 가능한 범위로 보수적으로 제안하세요

추천 기준:
1. 읽기 쉬운 대비
2. 피사체 보호
3. 시각적 균형
4. 카드뉴스 표지로서의 안정감
`;

  const userInstruction = `
텍스트 정보:
- 라벨: ${safePage.label}
- 제목: ${safePage.title}
- 본문: ${safePage.body}

현재 텍스트 박스 정보:
- width: ${safeCurrentLayout.width}%
- titleSize: ${safeCurrentLayout.titleSize}
- subtitleSize: ${safeCurrentLayout.subtitleSize}
- align: ${safeCurrentLayout.align}

캔버스 크기:
- ${safeCanvas.width} x ${safeCanvas.height}

JSON으로만 답하세요.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userInstruction
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "layout_recommendation",
            strict: true,
            schema
          }
        },
        temperature: 0.2
      })
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("OpenAI analyze-layout raw response:", rawText);
      return res.status(502).json({
        error: "OpenAI 응답을 JSON으로 읽지 못했습니다."
      });
    }

    if (!response.ok) {
      console.error("OpenAI analyze-layout error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "AI 레이아웃 분석에 실패했습니다.",
        detail: data
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return res.status(502).json({
        error: "OpenAI 응답에 content가 없습니다."
      });
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("OpenAI analyze-layout content:", content);
      return res.status(502).json({
        error: "AI 레이아웃 결과를 JSON으로 변환하지 못했습니다."
      });
    }

    if (!result?.recommendedPosition) {
      return res.status(502).json({
        error: "AI 추천 위치가 없습니다."
      });
    }

    result.recommendedPosition.x = Math.max(
      0,
      Math.min(100 - safeCurrentLayout.width, Number(result.recommendedPosition.x) || 8)
    );

    result.recommendedPosition.y = Math.max(
      0,
      Math.min(92, Number(result.recommendedPosition.y) || 58)
    );

    if (!["left", "center", "right"].includes(result.recommendedPosition.align)) {
      result.recommendedPosition.align = "left";
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("analyze-layout server error:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "AI 레이아웃 분석 중 서버 오류가 발생했습니다."
    });
  }
}
