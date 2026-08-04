/**
 * api/plan-carousel.js
 * INWAVE 카드뉴스 기획 + 필요 시 웹 검색 + 캡션/해시태그 생성
 */

export const maxDuration = 60;

const SEARCH_KEYWORDS = [
  "검색해줘",
  "인터넷에서",
  "찾아줘",
  "조사해줘",
  "논문",
  "연구자료",
  "통계",
  "출처",
  "근거",
  "최신",
  "최근",
  "요즘",
  "국내외",
  "시장 동향",
  "잘 모르겠",
  "트렌드",
  "사례",
  "보고서",
  "2025",
  "2026"
];

function needsWebSearch(messages) {
  const recentUserText = messages
    .filter(
      (message) =>
        message?.role === "user" &&
        typeof message.content === "string"
    )
    .slice(-6)
    .map((message) => message.content)
    .join("\n")
    .toLowerCase();

  return SEARCH_KEYWORDS.some(
    (keyword) =>
      recentUserText.includes(
        keyword.toLowerCase()
      )
  );
}

function safeMessages(messages) {
  return messages
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(
          message.role
        ) &&
        typeof message.content ===
          "string"
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(
        0,
        8000
      )
    }));
}

const PAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,

  required: [
    "pageNumber",
    "role",
    "label",
    "title",
    "titleLines",
    "body",
    "bodyLines",
    "koreanPromptSummary",
    "englishImagePrompt",
    "imageComposition",
    "sources"
  ],

  properties: {
    pageNumber: {
      type: "integer"
    },

    role: {
      type: "string",

      enum: [
        "hook",
        "context",
        "fact",
        "misconception",
        "observation",
        "behavior",
        "evidence",
        "comparison",
        "case",
        "implication",
        "insight",
        "strategy",
        "opportunity",
        "solution",
        "action",
        "conclusion",
        "cta"
      ]
    },

    label: {
      type: "string"
    },

    title: {
      type: "string"
    },

    titleLines: {
      type: "array",
      minItems: 1,
      maxItems: 3,

      items: {
        type: "string"
      }
    },

    body: {
      type: "string"
    },

    bodyLines: {
      type: "array",
      minItems: 0,
      maxItems: 4,

      items: {
        type: "string"
      }
    },

    koreanPromptSummary: {
      type: "string"
    },

    englishImagePrompt: {
      type: "string"
    },

    imageComposition: {
      type: "object",
      additionalProperties: false,

      required: [
        "subjectPosition",
        "reservedTextArea",
        "cameraShot",
        "backgroundDensity"
      ],

      properties: {
        subjectPosition: {
          type: "string",

          enum: [
            "left",
            "left-center",
            "center",
            "right-center",
            "right",
            "upper",
            "lower"
          ]
        },

        reservedTextArea: {
          type: "string",

          enum: [
            "upper-left",
            "upper-center",
            "upper-right",
            "middle-left",
            "middle-right",
            "lower-left",
            "lower-center",
            "lower-right"
          ]
        },

        cameraShot: {
          type: "string",

          enum: [
            "close-up",
            "medium",
            "medium-wide",
            "wide",
            "over-the-shoulder",
            "high-angle",
            "low-angle"
          ]
        },

        backgroundDensity: {
          type: "string",

          enum: [
            "low",
            "medium"
          ]
        }
      }
    },

    sources: {
      type: "array",
      maxItems: 4,

      items: {
        type: "object",
        additionalProperties: false,

        required: [
          "claimType",
          "sourceTitle",
          "sourceOrganization",
          "sourceYear",
          "sourceUrl",
          "sourceNote"
        ],

        properties: {
          claimType: {
            type: "string",

            enum: [
              "researched_fact",
              "case_reference",
              "background_reference"
            ]
          },

          sourceTitle: {
            type: "string"
          },

          sourceOrganization: {
            type: "string"
          },

          sourceYear: {
            type: "string"
          },

          sourceUrl: {
            type: "string"
          },

          sourceNote: {
            type: "string"
          }
        }
      }
    }
  }
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,

  required: [
    "isComplete",
    "chatReply",
    "searchUsed",
    "projectTitle",
    "storyboard",
    "instagramPost"
  ],

  properties: {
    isComplete: {
      type: "boolean"
    },

    chatReply: {
      type: "string",
      minLength: 1
    },

    searchUsed: {
      type: "boolean"
    },

    projectTitle: {
      type: "string"
    },

    storyboard: {
      type: "object",
      additionalProperties: false,

      required: [
        "pages"
      ],

      properties: {
        pages: {
          type: "array",
          minItems: 0,
          maxItems: 5,
          items: PAGE_SCHEMA
        }
      }
    },

    instagramPost: {
      type: "object",
      additionalProperties: false,

      required: [
        "captions",
        "cta",
        "hashtags"
      ],

      properties: {
        captions: {
          type: "object",
          additionalProperties: false,

          required: [
            "short",
            "informative",
            "conversational"
          ],

          properties: {
            short: {
              type: "string"
            },

            informative: {
              type: "string"
            },

            conversational: {
              type: "string"
            }
          }
        },

        cta: {
          type: "string"
        },

        hashtags: {
          type: "array",
          minItems: 0,
          maxItems: 18,

          items: {
            type: "string"
          }
        }
      }
    }
  }
};

const SYSTEM_PROMPT = `
당신은 INWAVE의 수석 광고 콘텐츠 기획자입니다.

인스타그램 4:5 카드뉴스를
광고주, 광고대행사, 오프라인 광고 매체 운영자가
클릭하고 저장할 만한 광고 인사이트 콘텐츠로 기획합니다.

회사소개 브로슈어처럼 쓰지 말고,
광고주의 질문과 문제에서 시작하여
데이터 인사이트를 제공한 뒤,
필요한 경우 후반부에서
INWAVE 측정 가치를 자연스럽게 연결하세요.

────────────────────────
[대화 완료 판단]
────────────────────────

정보가 부족하면
가장 중요한 질문 1~2개만 하며

- isComplete: false
- storyboard.pages: []

로 반환합니다.

사용자가 다음과 같은 뜻을 표현하면
추가 질문 없이 완성합니다.

- 알아서
- 바로 진행
- 이대로
- 만들어줘
- 네가 판단
- 지금 내용으로 제작해줘
- 카드뉴스 만들어줘
- 충분해

────────────────────────
[검색]
────────────────────────

웹 검색 도구가 제공되면
최신성, 통계, 사례, 출처가 필요한 주장만 검색합니다.

검색 결과는 반드시
실제 URL과 기관명을 sources에 저장합니다.

확인되지 않은 수치를 만들지 않습니다.

출처가 불충분하면
단정형 문장이 아니라 조건형 문장으로 바꿉니다.

검색 중간 안내 문장을
최종 chatReply에 넣지 않습니다.

다음과 같은 문장은
최종 답변에 사용하지 않습니다.

- 잠시만 기다려 주세요
- 검색해 보겠습니다
- 자료를 확인하겠습니다
- 분석 중입니다
- 확인 후 알려드리겠습니다

────────────────────────
[구성]
────────────────────────

주제에 맞춰 3~5장으로 구성합니다.

모든 콘텐츠를
표지 → 문제 → 비교 → 체크리스트 → 해결책
구조로 고정하지 않습니다.

가능한 역할:

- hook
- context
- fact
- misconception
- observation
- behavior
- evidence
- comparison
- case
- implication
- insight
- strategy
- opportunity
- solution
- action
- conclusion
- cta

각 장표는 새로운 정보를 제공해야 합니다.

앞 장표의 내용을 반복하지 않습니다.

전체 장표를 읽었을 때
하나의 논리적인 이야기로 연결되어야 합니다.

────────────────────────
[문장]
────────────────────────

제목 규칙:

- 한글 24자 이내 권장
- 2줄 권장
- 최대 3줄
- 핵심 단어를 줄 사이에서 분리하지 않기
- 한 글자만 남는 줄 금지
- 조사만 남는 줄 금지
- 카드뉴스에서 즉시 이해되는 일상어 사용

본문 규칙:

- 45~65자 권장
- 최대 2문장
- 2~4줄
- 보고서처럼 길게 작성하지 않기
- 제목을 그대로 반복하지 않기
- 마침표가 다음 줄 첫 글자로 넘어가지 않기

titleLines와 bodyLines는
실제 캔버스에 표시할 줄 구성입니다.

title은 titleLines를
공백으로 합친 내용과 같은 의미여야 합니다.

body도 bodyLines를
공백으로 합친 내용과 같은 의미여야 합니다.

────────────────────────
[역할별 디자인]
────────────────────────

hook:

- 제목 68~82px에 어울리는 강한 후킹
- 큰 여백
- 단순한 이미지
- 2~3줄 이내

일반 장표:

- 제목 56~68px
- 정보 전달 우선
- 제목 최대 2줄 권장
- 본문 최대 4줄

cta:

- 제목 62~74px
- 짧고 직접적인 행동 문장
- 과도한 영업 문구 금지
- 추상적인 회사 홍보 금지

────────────────────────
[이미지 구도]
────────────────────────

이미지를 만들기 전에
imageComposition을 먼저 결정합니다.

reservedTextArea는
나중에 한국어 텍스트가 놓일
깨끗하고 저밀도인 영역입니다.

englishImagePrompt에는
예약 영역을 명확히 적습니다.

얼굴, 손, 휴대전화, 제품,
핵심 행동이 예약 영역을 침범하지 않게 합니다.

장표마다 다음 요소를 다양하게 합니다.

- 장소
- 인물 수
- 카메라 거리
- 행동
- 피사체 위치
- 촬영 각도
- 시간대
- 조명

카페나 따뜻한 실내를
모든 장표에 반복하지 않습니다.

역할별 장면 예시:

hook:
- 인물 1명
- 강한 상징 장면
- 큰 여백
- 단순한 구도

behavior / observation:
- 여러 고객의 자연스러운 행동
- 관찰형 사진
- 지나가는 사람과 멈춘 사람의 대비

fact / evidence / insight:
- 회의 장면
- 분석 행동
- 글자 없는 색상 블록
- 흐릿한 화면
- 숫자 없는 단순 막대 형태

strategy / action:
- 손과 빈 노트
- 선택과 계획 행동
- 오버숄더
- 클로즈업

cta:
- 실행을 준비하는 인물
- 표지와 다른 구도
- 행동 중심

────────────────────────
[이미지 문자 위험 방지]
────────────────────────

이미지에서 다음 요소를 피합니다.

- 선명한 분석 대시보드
- 문서의 글자
- 상점 간판
- 메뉴판
- 포스터
- 휴대전화 UI
- 컴퓨터 화면 글자
- 차량 번호판
- 브랜드 상품
- 차트 축 이름
- 광고 문구
- 로고

모든 이미지 프롬프트에는
다음 조건을 포함합니다.

vertical 4:5 Instagram composition
photorealistic editorial or documentary photography
one coherent photographic scene
no readable text
no pseudo-text
no fake letters
no invented writing
no numbers
no visible labels
no readable charts
all screens and papers blank or heavily blurred
no logos
no watermark
no UI overlay
no infographic
no split screen
no collage

────────────────────────
[INWAVE 연결]
────────────────────────

INWAVE는 다음 데이터를 측정할 수 있습니다.

- 실제 시청자 수
- 시청 시간
- 시간대별 관심도
- 소재별 반응 차이
- 위치별 광고 성과
- 시선 데이터
- 데이터 기반 광고 운영

모든 장표에서 INWAVE를 반복하지 않습니다.

초반에는 광고주의 문제와 인사이트를 설명하고,
후반부에서 주제와 관련된 측정 가치만
자연스럽게 연결합니다.

────────────────────────
[캡션]
────────────────────────

기획 완료 시
전체 카드뉴스 기준으로 다음을 생성합니다.

- 짧고 강한 캡션
- 정보형 캡션
- 대화형 캡션
- CTA
- 해시태그 10~18개

캡션은 전문적이지만
딱딱하지 않게 작성합니다.

회사 이름을 반복하지 않습니다.

카드뉴스 문구를
그대로 복사하지 않습니다.

이모지는 0~3개만 사용합니다.

해시태그는 다음 범주를 섞습니다.

- 핵심 주제
- 타깃
- 실무
- 세부 주제

마지막에는
#INWAVE 또는 #인웨이브를
1~2개 배치합니다.

다음 태그는 금지합니다.

- #맞팔
- #선팔
- #좋아요반사
- 게시물과 관련 없는 인기 태그

projectTitle은
파일명에 사용할 짧은 한글 문구로 작성합니다.

- 6~14자 권장
- 특수문자 금지
- 공백 금지

반드시 JSON 스키마만 반환하세요.
`;

function extractResponseText(data) {
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const parts = [];

  for (const item of data?.output || []) {
    if (item?.type !== "message") {
      continue;
    }

    for (const content of item.content || []) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string" &&
        content.text.trim()
      ) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n\n").trim();
}

function extractWebSources(data) {
  const sources = [];
  const seen = new Set();

  function addSource(source = {}) {
    const url = String(
      source.url ||
      source.link ||
      source.source_url ||
      ""
    ).trim();

    if (
      !url ||
      !/^https?:\/\//i.test(url) ||
      seen.has(url)
    ) {
      return;
    }

    seen.add(url);

    sources.push({
      title: String(
        source.title ||
        source.name ||
        source.source_title ||
        "웹 자료"
      ).trim(),
      url
    });
  }

  for (const item of data?.output || []) {
    if (item?.type === "web_search_call") {
      const actionSources =
        item?.action?.sources ||
        item?.sources ||
        [];

      if (Array.isArray(actionSources)) {
        actionSources.forEach(addSource);
      }
    }

    if (item?.type === "message") {
      for (const content of item.content || []) {
        for (
          const annotation of
            content?.annotations || []
        ) {
          if (
            annotation?.type ===
            "url_citation"
          ) {
            addSource({
              title: annotation.title,
              url: annotation.url
            });
          }
        }
      }
    }
  }

  return sources.slice(0, 20);
}

function buildResearchQuery(messages) {
  const conversation = messages
    .map((message) => {
      const speaker =
        message.role === "assistant"
          ? "AI"
          : "사용자";

      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  return `
다음 대화를 바탕으로 INWAVE 인스타그램 카드뉴스 기획에 필요한 자료를 조사하세요.

조사 원칙:
- 광고주, 광고대행사, 오프라인 광고 매체 운영자가 실무에 활용할 수 있는 근거를 찾습니다.
- 최신 통계, 연구, 브랜드 사례, 시장 동향, 소비자 행동 변화를 우선 확인합니다.
- 확인되지 않은 숫자나 사실은 만들지 않습니다.
- 공식 기관, 연구기관, 기업 공식 자료, 신뢰할 수 있는 업계 자료를 우선합니다.
- 카드뉴스에 활용할 핵심 사실을 짧게 정리합니다.
- 각 사실에 출처명, 연도, 실제 URL을 함께 적습니다.
- 최종 카드뉴스 JSON은 만들지 말고 조사 메모만 작성합니다.

대화:
${conversation}
`.trim();
}

async function researchWithWeb(
  model,
  messages
) {
  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${process.env.OPENAI_API_KEY}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        model,

        tools: [
          {
            type: "web_search"
          }
        ],

        tool_choice: "auto",

        include: [
          "web_search_call.action.sources"
        ],

        input:
          buildResearchQuery(
            messages
          )
      })
    }
  );

  const raw =
    await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    console.error(
      "웹 검색 API 원본 응답:",
      raw
    );

    throw new Error(
      "웹 검색 응답을 JSON으로 읽지 못했습니다."
    );
  }

  if (!response.ok) {
    console.error(
      "웹 검색 API 오류:",
      data
    );

    throw new Error(
      data?.error?.message ||
        `웹 검색 API 오류: HTTP ${response.status}`
    );
  }

  const researchText =
    extractResponseText(data);

  const sources =
    extractWebSources(data);

  if (!researchText) {
    console.error(
      "웹 검색 결과 텍스트 없음:",
      data
    );

    throw new Error(
      "웹 검색 결과 내용을 받지 못했습니다."
    );
  }

  return {
    researchText,
    sources
  };
}

function cleanJsonString(value) {
  const source =
    String(value || "").trim();

  if (!source) {
    return "";
  }

  let cleaned = source
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // 아래에서 안전하게 JSON 객체 범위를 탐색합니다.
  }

  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let index = 0;
    index < cleaned.length;
    index += 1
  ) {
    const char = cleaned[index];

    if (startIndex === -1) {
      if (char === "{") {
        startIndex = index;
        depth = 1;
      }

      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return cleaned
          .slice(
            startIndex,
            index + 1
          )
          .trim();
      }
    }
  }

  return cleaned;
}

async function callChatCompletions(
  model,
  messages,
  researchContext = null
) {
  const researchMessage =
    researchContext
      ? {
          role: "system",
          content: `
아래는 웹 검색으로 수집한 조사 메모입니다.

반드시 다음 원칙을 지키세요.
- 조사 메모에 없는 숫자나 사실을 새로 만들지 마세요.
- 장표의 sources에는 아래 URL 목록에 있는 실제 URL만 사용하세요.
- 출처가 충분하지 않은 주장은 조건형 문장으로 바꾸세요.
- 검색 결과 문장을 그대로 복사하지 말고 카드뉴스 문장으로 재구성하세요.
- 출처를 사용하지 않은 장표의 sources는 빈 배열로 반환하세요.

[조사 메모]
${researchContext.researchText}

[검색에서 수집한 URL 목록]
${JSON.stringify(
  researchContext.sources,
  null,
  2
)}
`.trim()
        }
      : null;

  const requestMessages = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT
    },

    ...(researchMessage
      ? [researchMessage]
      : []),

    ...messages
  ];

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${process.env.OPENAI_API_KEY}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        model,

        messages:
          requestMessages,

        response_format: {
          type:
            "json_schema",

          json_schema: {
            name:
              "inwave_carousel_plan",

            strict: true,

            schema:
              RESPONSE_SCHEMA
          }
        },

        temperature: 0.45
      })
    }
  );

  const raw =
    await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    console.error(
      "Chat Completions 원본 응답:",
      raw
    );

    throw new Error(
      "Chat Completions 응답을 JSON으로 읽지 못했습니다."
    );
  }

  if (!response.ok) {
    console.error(
      "Chat Completions 오류:",
      data
    );

    throw new Error(
      data?.error?.message ||
        `Chat Completions 오류: HTTP ${response.status}`
    );
  }

  const content =
    data?.choices?.[0]?.message
      ?.content;

  if (
    !content ||
    typeof content !== "string"
  ) {
    console.error(
      "Chat Completions content 없음:",
      data
    );

    throw new Error(
      "Chat Completions 응답에 결과 텍스트가 없습니다."
    );
  }

  return content;
}

function normalizeResult(
  result,
  searchUsed
) {
  result.searchUsed =
    Boolean(searchUsed);

  const rawReply =
    typeof result.chatReply ===
      "string"
      ? result.chatReply.trim()
      : "";

  result.chatReply =
    rawReply ||
    (
      result.isComplete
        ? "카드뉴스 기획이 완료되었습니다. 아래에서 장표별 내용을 확인해 주세요."
        : "주제와 타깃은 확인했습니다. 카드뉴스에서 가장 강조하고 싶은 핵심 문제나 결론을 한 가지 알려주세요."
    );

  result.projectTitle =
    String(
      result.projectTitle ||
        "광고인사이트"
    )
      .replace(
        /[\\/:*?"<>|\s]+/g,
        ""
      )
      .slice(0, 20) ||
    "광고인사이트";

  if (!result.isComplete) {
    result.storyboard = {
      pages: []
    };

    result.instagramPost = {
      captions: {
        short: "",
        informative: "",
        conversational: ""
      },

      cta: "",

      hashtags: []
    };

    return result;
  }

  result.storyboard.pages =
    (
      result.storyboard?.pages ||
      []
    )
      .slice(0, 5)
      .map(
        (page, index) => ({
          ...page,

          pageNumber:
            index + 1,

          titleLines:
            Array.isArray(
              page.titleLines
            ) &&
            page.titleLines.length
              ? page.titleLines.slice(
                  0,
                  3
                )
              : [
                  page.title || ""
                ],

          bodyLines:
            Array.isArray(
              page.bodyLines
            )
              ? page.bodyLines.slice(
                  0,
                  4
                )
              : [],

          sources:
            Array.isArray(
              page.sources
            )
              ? page.sources.slice(
                  0,
                  4
                )
              : []
        })
      );

  return result;
}

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  if (
    req.method !== "POST"
  ) {
    return res.status(405).json({
      error:
        "POST 요청만 지원합니다."
    });
  }

  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    return res.status(500).json({
      error:
        "OPENAI_API_KEY가 설정되지 않았습니다."
    });
  }

  const messages =
    safeMessages(
      req.body?.messages || []
    );

  if (!messages.length) {
    return res.status(400).json({
      error:
        "사용 가능한 messages 배열이 필요합니다."
    });
  }

  const searchUsed =
    needsWebSearch(messages);

  const model =
    process.env
      .OPENAI_TEXT_MODEL
      ?.trim() ||
    "gpt-4.1-mini";

  const searchModel =
    process.env
      .OPENAI_SEARCH_MODEL
      ?.trim() ||
    model;

  try {
    let researchContext =
      null;

    if (searchUsed) {
      researchContext =
        await researchWithWeb(
          searchModel,
          messages
        );
    }

    const text =
      await callChatCompletions(
        model,
        messages,
        researchContext
      );

    if (
      !text ||
      typeof text !== "string"
    ) {
      throw new Error(
        "OpenAI 응답에 결과 텍스트가 없습니다."
      );
    }

    let result;

    try {
      result =
        JSON.parse(
          cleanJsonString(text)
        );
    } catch {
      console.error(
        "기획 결과 원문:",
        text
      );

      throw new Error(
        "기획 결과를 JSON으로 변환하지 못했습니다."
      );
    }

    if (
      typeof result.isComplete !==
      "boolean"
    ) {
      throw new Error(
        "OpenAI 응답 구조가 올바르지 않습니다."
      );
    }

    result =
      normalizeResult(
        result,
        searchUsed
      );

    if (
      result.isComplete &&
      result.storyboard.pages
        .length < 3
    ) {
      throw new Error(
        "완료된 카드뉴스는 최소 3장이어야 합니다."
      );
    }

    return res
      .status(200)
      .json(result);
  } catch (error) {
    console.error(
      "plan-carousel 오류:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "스토리보드 생성 중 오류가 발생했습니다."
    });
  }
}
