/**
 * api/analyze-layout.js
 * OpenAI 비전 기반 카드뉴스 텍스트 레이아웃 추천
 */
export const maxDuration = 60;

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

function normalizeAvoidAreas(areas = []) {
  return (Array.isArray(areas) ? areas : []).map(area => {
    const x = clamp(area?.x, 0, 100, 0);
    const y = clamp(area?.y, 0, 100, 0);
    const width = clamp(area?.width, 0, 100 - x, 0);
    const height = clamp(area?.height, 0, 100 - y, 0);
    return { x, y, width, height, reason: String(area?.reason || "주 피사체") };
  }).filter(area => area.width >= 2 && area.height >= 2).slice(0, 8);
}

function estimatedTextHeightPercent(layout, canvas) {
  const titleLines = Math.max(1, Array.isArray(layout.titleLines) ? layout.titleLines.length : 1);
  const bodyLines = Array.isArray(layout.bodyLines) ? layout.bodyLines.length : 0;
  const labelHeight = 42;
  const titleHeight = titleLines * layout.titleSize * 1.16;
  const bodyHeight = bodyLines ? 18 + bodyLines * layout.bodySize * 1.42 : 0;
  const totalPixels = labelHeight + titleHeight + bodyHeight;
  return clamp(totalPixels / canvas.height * 100, 12, 48, 30);
}

function overlapRatio(layout, area, canvas) {
  const height = estimatedTextHeightPercent(layout, canvas);
  const ax1 = layout.x;
  const ay1 = layout.y;
  const ax2 = layout.x + layout.width;
  const ay2 = layout.y + height;
  const bx1 = area.x;
  const by1 = area.y;
  const bx2 = area.x + area.width;
  const by2 = area.y + area.height;
  const width = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const overlapHeight = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  return (width * overlapHeight) / Math.max(1, layout.width * height);
}

function candidateLayouts(layout) {
  const widths = [layout.width, Math.max(48, layout.width - 8)];
  const candidates = [];
  for (const width of widths) {
    candidates.push(
      { ...layout, x: 6, y: 7, width, align: "left" },
      { ...layout, x: 6, y: 58, width, align: "left" },
      { ...layout, x: 94 - width, y: 7, width, align: "right" },
      { ...layout, x: 94 - width, y: 58, width, align: "right" },
      { ...layout, x: (100 - width) / 2, y: 62, width, align: "center" }
    );
  }
  return candidates;
}

function layoutConflict(layout, avoidAreas, canvas) {
  return avoidAreas.reduce((maximum, area) => Math.max(maximum, overlapRatio(layout, area, canvas)), 0);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 지원합니다." });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." });

  const {
    imageDataUrl,
    page = {},
    currentLayout = {},
    canvas = {},
    designMode = page.designMode || "photo-heavy"
  } = req.body || {};

  const templateType = String(page.templateType || "photo-hook");
  const safeDesignMode = ["photo-heavy", "hybrid"].includes(designMode) ? designMode : "photo-heavy";
  if (!["photo-hook", "editorial-photo"].includes(templateType)) {
    return res.status(400).json({ error: "AI 자동 위치는 전체 사진형 템플릿에서만 사용합니다." });
  }
  if (!imageDataUrl || typeof imageDataUrl !== "string") return res.status(400).json({ error: "imageDataUrl이 필요합니다." });

  const safePage = {
    role: String(page.role || "insight").slice(0, 30),
    templateType,
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
    overlayOpacity: clamp(currentLayout.overlayOpacity ?? currentLayout.overlay, 0.2, 0.7, 0.42),
    titleLines: safePage.titleLines,
    bodyLines: safePage.bodyLines
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
- 제목은 의미 단위 2줄 권장, 최대 3줄. 한 글자·조사·단위·기호만 남는 줄을 금지합니다.
- 본문은 최대 4줄. 마침표·쉼표·화살표·퍼센트·숫자 단위가 다음 줄 첫 글자나 단독 줄이 되지 않게 합니다.
- hook은 68~82px, 일반 장표는 56~68px, cta는 62~74px 범위가 우선입니다.
- 제목/본문 전체가 94% 높이 안에 들어가야 합니다.
- 인물, 손, 제품, 화면과 최소한의 안전 여백을 둡니다.
- 배경이 복잡하면 더 평온한 영역을 선택합니다. photo-heavy는 텍스트 폭 48~76%, 오버레이 0.28~0.55를 우선합니다. hybrid는 텍스트 폭 40~58%, 오버레이 0.20~0.42를 우선해 사진과 데이터 영역의 균형을 유지합니다.
- 추천 텍스트 영역이 avoidAreas와 크게 겹치지 않도록 합니다.
- 텍스트가 이미지 의미를 가리지 않도록 합니다.
- JSON만 반환합니다.
`;

  const userText = `
장표 역할: ${safePage.role}
템플릿: ${safePage.templateType}
디자인 모드: ${safeDesignMode}
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
        }
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
    result.avoidAreas = normalizeAvoidAreas(result.avoidAreas);
    const modeWidth = safeDesignMode === "hybrid" ? clamp(width, 40, 58, 50) : clamp(width, 48, 76, 68);
    const layout = {
      x: clamp(recommended.x, 0, 100 - modeWidth, safeLayout.x),
      y: clamp(recommended.y, 0, 90, safeLayout.y),
      width: modeWidth,
      align: ["left", "center", "right"].includes(recommended.align) ? recommended.align : safeLayout.align,
      titleSize: clamp(recommended.titleSize, 48, 100, safeLayout.titleSize),
      bodySize: clamp(recommended.bodySize, 22, 48, safeLayout.bodySize),
      overlayOpacity: safeDesignMode === "hybrid"
        ? clamp(recommended.overlayOpacity, 0.2, 0.42, 0.3)
        : clamp(recommended.overlayOpacity, 0.28, 0.55, safeLayout.overlayOpacity),
      titleLines: Array.isArray(recommended.titleLines) && recommended.titleLines.length ? recommended.titleLines.slice(0, 3) : safePage.titleLines,
      bodyLines: Array.isArray(recommended.bodyLines) ? recommended.bodyLines.slice(0, 4) : safePage.bodyLines
    };

    if (layoutConflict(layout, result.avoidAreas, safeCanvas) > 0.35) {
      const candidates = candidateLayouts(layout)
        .map(candidate => ({ candidate, score: layoutConflict(candidate, result.avoidAreas, safeCanvas) }))
        .sort((a, b) => a.score - b.score);
      if (candidates.length && candidates[0].score < layoutConflict(layout, result.avoidAreas, safeCanvas)) {
        Object.assign(layout, candidates[0].candidate);
      }
    }

    result.recommendedLayout = layout;
    return res.status(200).json(result);
  } catch (error) {
    console.error("analyze-layout 오류:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "AI 레이아웃 분석 중 오류가 발생했습니다." });
  }
}

