/**
 * api/analyze-layout.js
 * OpenAI 비전 기반 카드뉴스 텍스트 레이아웃 추천
 */

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendedLayout", "reason", "avoidAreas"],
  properties: {
    recommendedLayout: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "width", "align", "titleSize", "bodySize", "overlayOpacity", "titleLines", "bodyLines"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        align: { type: "string", enum: ["left", "center", "right"] },
        titleSize: { type: "number" },
        bodySize: { type: "number" },
        overlayOpacity: { type: "number" },
        titleLines: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
        bodyLines: { type: "array", minItems: 0, maxItems: 4, items: { type: "string" } }
      }
    },
    reason: { type: "string" },
    avoidAreas: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["x", "y", "width", "height", "reason"],
        properties: {
          x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" }, reason: { type: "string" }
        }
      }
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 지원합니다." });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });

  const { imageDataUrl, page = {}, currentLayout = {}, canvas = {} } = req.body || {};
  if (!imageDataUrl || typeof imageDataUrl !== "string") return res.status(400).json({ error: "imageDataUrl이 필요합니다." });

  const safePage = {
    role: String(page.role || "insight").slice(0, 30),
    label: String(page.label || "").slice(0, 100),
    title: String(page.title || "").slice(0, 500),
    body: String(page.body || "").slice(0, 1000),
    titleLines: Array.isArray(page.titleLines) ? page.titleLines.slice(0, 3).map(String) : [],
    bodyLines: Array.isArray(page.bodyLines) ? page.bodyLines.slice(0, 4).map(String) : []
  };

  const safeLayout = {
    x: clamp(currentLayout.x, 0, 90, 8),
    y: clamp(currentLayout.y, 0, 92, 58),
    width: clamp(currentLayout.width, 40, 88, 70),
    align: ["left", "center", "right"].includes(currentLayout.align) ? currentLayout.align : "left",
    titleSize: clamp(currentLayout.titleSize, 48, 100, 68),
    bodySize: clamp(currentLayout.bodySize ?? currentLayout.subtitleSize, 22, 48, 30),
    overlayOpacity: clamp(currentLayout.overlayOpacity, 0, 1, 0.8)
  };

  const safeCanvas = {
    width: clamp(canvas.width, 500, 3000, 1080),
    height: clamp(canvas.height, 500, 4000, 1350)
  };

  const systemPrompt = `
당신은 한국어 인스타그램 카드뉴스의 이미지·타이포그래피 레이아웃 디렉터입니다.
이미지에서 얼굴, 손, 휴대전화, 상품, 화면, 핵심 행동과 주 피사체를 찾아 텍스트가 가리지 않게 배치합니다.
추천 대상은 x, y, width, 정렬, 제목 크기, 본문 크기, 오버레이, 실제 줄바꿈입니다.
좌표와 width는 캔버스 대비 퍼센트입니다.

규칙:
- 제목은 의미 단위 2줄 권장, 최대 3줄. 한 글자만 남는 줄 금지.
- 본문은 최대 4줄. 마침표가 줄 첫 글자로 넘어가지 않게 합니다.
- hook은 68~82px, 일반 장표는 56~68px, cta는 62~74px 범위가 우선입니다.
- 제목/본문 전체가 94% 높이 안에 들어가야 합니다.
- 인물, 손, 제품, 화면과 최소한의 안전 여백을 둡니다.
- 배경이 복잡하면 width를 줄이기보다 더 평온한 영역을 선택하고 오버레이를 높입니다.
- 텍스트가 이미지 의미를 가리지 않도록 합니다.
- JSON만 반환합니다.
`;

  const userText = `
장표 역할: ${safePage.role}
라벨: ${safePage.label}
제목: ${safePage.title}
현재 제목 줄: ${JSON.stringify(safePage.titleLines)}
본문: ${safePage.body}
현재 본문 줄: ${JSON.stringify(safePage.bodyLines)}
현재 레이아웃: ${JSON.stringify(safeLayout)}
캔버스: ${safeCanvas.width} x ${safeCanvas.height}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL?.trim() || process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "layout_recommendation", strict: true, schema: SCHEMA }
        },
        temperature: 0.15
      })
    });

    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("OpenAI 응답을 JSON으로 읽지 못했습니다."); }
    if (!response.ok) throw new Error(data?.error?.message || `AI 레이아웃 API 오류: HTTP ${response.status}`);

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 레이아웃 결과가 없습니다.");

    let result;
    try { result = JSON.parse(content); } catch { throw new Error("AI 레이아웃 결과를 변환하지 못했습니다."); }

    const recommended = result.recommendedLayout || {};
    const width = clamp(recommended.width, 40, 88, safeLayout.width);
    result.recommendedLayout = {
      x: clamp(recommended.x, 0, 100 - width, safeLayout.x),
      y: clamp(recommended.y, 0, 90, safeLayout.y),
      width,
      align: ["left", "center", "right"].includes(recommended.align) ? recommended.align : safeLayout.align,
      titleSize: clamp(recommended.titleSize, 48, 100, safeLayout.titleSize),
      bodySize: clamp(recommended.bodySize, 22, 48, safeLayout.bodySize),
      overlayOpacity: clamp(recommended.overlayOpacity, 0, 1, safeLayout.overlayOpacity),
      titleLines: Array.isArray(recommended.titleLines) && recommended.titleLines.length ? recommended.titleLines.slice(0, 3) : safePage.titleLines,
      bodyLines: Array.isArray(recommended.bodyLines) ? recommended.bodyLines.slice(0, 4) : safePage.bodyLines
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("analyze-layout 오류:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "AI 레이아웃 분석 중 오류가 발생했습니다." });
  }
}
