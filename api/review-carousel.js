/**
 * api/review-carousel.js
 * Claude가 만든 카드뉴스 기획을 OpenAI가 검수합니다.
 */
export const maxDuration = 60;

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pass", "overallScore", "summary", "issues"],
  properties: {
    pass: { type: "boolean" },
    overallScore: { type: "number" },
    summary: { type: "string" },
    issues: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageNumber", "severity", "category", "issue", "instruction"],
        properties: {
          pageNumber: { type: "integer" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          category: { type: "string", enum: ["fact", "repetition", "hook", "advertiser", "template", "sales", "image", "flow", "copy"] },
          issue: { type: "string" },
          instruction: { type: "string" }
        }
      }
    }
  }
};

function cleanJson(value = "") {
  return String(value).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 지원합니다." });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY가 없습니다." });

  const { storyboard, instagramPost = {}, researchContext = null } = req.body || {};
  if (!storyboard?.pages?.length) return res.status(400).json({ error: "검수할 storyboard.pages가 없습니다." });

  const model = process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_TEXT_MODEL;
  if (!model) return res.status(500).json({ error: "OPENAI_REVIEW_MODEL 또는 OPENAI_TEXT_MODEL이 없습니다." });

  const systemPrompt = `당신은 INWAVE 인스타그램 카드뉴스의 엄격한 편집장입니다.
광고주·광고대행사·매체 운영자가 클릭하고 저장할 광고 인사이트인지 검수합니다.

검수 규칙:
- 장표마다 새로운 정보가 있어야 하며 앞 장표를 반복하면 안 됩니다.
- 1장 후킹이 짧고 즉시 이해되어야 합니다.
- 회사소개, 기술 자랑, 과도한 영업 문구를 지적합니다.
- INWAVE는 후반부에 문제 해결 방법으로 자연스럽게 등장해야 합니다.
- 조사 메모에 없는 구체적 수치나 사실은 high로 지적합니다.
- 3~5장 전체에서 최소 3종의 templateType을 사용하는 것이 좋습니다.
- 2장 이후 photo-hook/editorial-photo만 반복하면 지적합니다.
- photoRequirement=none인 장표에 이미지 프롬프트가 있으면 지적합니다.
- 비교형·숫자형·카드형의 visualData가 비어 있으면 지적합니다.
- 제목과 본문이 길거나 보고서 문장처럼 딱딱하면 지적합니다.
- 점수는 0~100이며, high 문제가 없고 전체 점수가 85 이상일 때만 pass=true로 합니다.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `조사 메모:\n${researchContext?.researchText || "없음"}\n\n사용 가능한 출처:\n${JSON.stringify(researchContext?.sources || [], null, 2)}\n\n스토리보드:\n${JSON.stringify(storyboard, null, 2)}\n\n인스타그램 게시글:\n${JSON.stringify(instagramPost, null, 2)}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "inwave_carousel_review", strict: true, schema: REVIEW_SCHEMA }
        }
      })
    });

    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("OpenAI 검수 응답을 JSON으로 읽지 못했습니다."); }
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI 검수 오류 HTTP ${response.status}`);

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI 검수 결과가 없습니다.");
    return res.status(200).json(JSON.parse(cleanJson(content)));
  } catch (error) {
    console.error("review-carousel 오류:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "카드뉴스 검수 중 오류가 발생했습니다." });
  }
}
