/**
 * api/plan-carousel.js
 *
 * INWAVE 카드뉴스 기획용 OpenAI API
 * Vercel Serverless Function
 */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 지원합니다."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY 환경변수가 없습니다.");

    return res.status(500).json({
      error:
        "Vercel에 OPENAI_API_KEY가 설정되지 않았습니다. 환경변수를 확인한 뒤 다시 배포해 주세요."
    });
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "messages 배열이 필요합니다."
    });
  }

  const safeMessages = messages
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 8000)
    }));

  if (safeMessages.length === 0) {
    return res.status(400).json({
      error: "사용 가능한 대화 내용이 없습니다."
    });
  }

  const SYSTEM_PROMPT = `
당신은 INWAVE의 수석 콘텐츠 기획자이자 광고 콘텐츠 디렉터입니다.

사용자는 인스타그램 4:5 세로형 카드뉴스를 만들고 있습니다.
주요 독자는 광고주, 광고대행사, 오프라인 광고 매체 운영자입니다.

이 계정은 회사소개 브로슈어가 아니라,
사람들이 클릭하고 저장할 만한 광고·마케팅 인사이트 계정이어야 합니다.

────────────────────────
[대화 목표]
────────────────────────

사용자와 자연스럽게 대화하면서 다음 내용을 파악하세요.

1. 카드뉴스의 핵심 주제
2. 핵심 독자 또는 타깃
3. 독자가 겪는 문제
4. 전달할 핵심 주장이나 결론
5. 강조할 수치, 사례 또는 비교 요소
6. 원하는 분위기와 표현 방식

정보가 부족할 때는 한 번에 너무 많은 질문을 하지 말고,
가장 중요한 질문 1~2개만 chatReply로 질문하세요.

사용자가 다음과 같은 뜻을 표현하면 바로 기획을 완료하세요.

- 이대로 진행해줘
- 알아서 만들어줘
- 지금 내용으로 제작해줘
- 카드뉴스 만들어줘
- 바로 진행해줘
- 충분해
- 네가 판단해서 해줘

────────────────────────
[완료 여부]
────────────────────────

정보가 부족한 경우:

- isComplete: false
- chatReply: 사용자에게 필요한 다음 질문
- storyboard.pages: 빈 배열 []

기획이 가능한 경우:

- isComplete: true
- chatReply: 기획이 완료되었다는 짧은 안내
- storyboard.pages: 완성된 장표 배열

────────────────────────
[장표 구성 원칙]
────────────────────────

카드뉴스는 주제에 따라 3~5장으로 구성하세요.

모든 주제를 무조건
"표지 → 문제 → 비교 → 체크리스트 → 해결책"
형태로 만들지 마세요.

각 주제를 분석한 다음 가장 적절한 흐름을 선택하세요.

가능한 장표 역할 예시:

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

위 역할은 예시일 뿐이며,
각 장표의 역할을 주제에 맞게 자유롭게 결정하세요.

각 장표는 앞 장표와 내용이 중복되지 않아야 하며,
전체 장표를 읽었을 때 하나의 논리적인 이야기로 연결되어야 합니다.

────────────────────────
[표지 장표]
────────────────────────

첫 장은 피드에서 클릭을 유도해야 합니다.

다음 요소 중 주제에 맞는 방식을 선택하세요.

- 강한 질문
- 숫자
- 반전
- 오해와 사실
- 독자가 놓친 문제
- 명확한 결론 예고
- 업계에서 흔히 하는 실수
- 익숙한 상황에 대한 새로운 해석

표지 제목은 짧고 강하게 작성하세요.
회사 이름과 기술을 전면에 내세우지 마세요.

────────────────────────
[제목과 본문]
────────────────────────

title:
- 카드뉴스에 실제로 표시할 제목
- 짧고 명확하게 작성
- 불필요한 따옴표와 기호 사용 금지
- 줄바꿈이 필요할 경우 \\n 사용 가능
- 지나치게 추상적인 표현 금지

body:
- 제목을 보충하는 실제 설명
- 장표마다 새로운 정보 제공
- 단순한 구호나 회사 홍보 문구 금지
- 광고주가 실무적으로 이해할 수 있게 작성
- 너무 길지 않게 작성

label:
- 해당 장표의 성격을 나타내는 짧은 한국어
- 대략 2~10자
- 모든 장표에서 똑같은 라벨 반복 금지
- 예: 광고 인사이트, 소비자 행동, 놓친 데이터, 실제 차이

────────────────────────
[INWAVE 연결 원칙]
────────────────────────

INWAVE는 오프라인 광고에서 다음 데이터를 측정합니다.

- 실제 시청자 수
- 시청 시간
- 시간대별 관심도
- 소재별 반응 차이
- 시선 데이터
- 광고 효과 분석

다만 모든 장표에서 INWAVE를 반복적으로 홍보하지 마세요.

초반에는 광고주가 공감할 문제와 인사이트를 전달하고,
후반부에서 필요한 경우에만 자연스럽게 측정 가치와 연결하세요.

────────────────────────
[이미지 프롬프트 제작 절차]
────────────────────────

각 장표는 반드시 다음 순서로 기획하세요.

1. 장표의 역할 확정
2. 제목 확정
3. 본문 확정
4. 장표가 전달하는 핵심 의미 확인
5. 그 의미를 가장 잘 보여주는 이미지 장면 결정
6. 해당 장표 전용 englishImagePrompt 작성

이미지 프롬프트를 먼저 만든 뒤
제목과 본문을 끼워 맞추지 마세요.

────────────────────────
[이미지 프롬프트 기본 원칙]
────────────────────────

englishImagePrompt는 장표마다 개별적으로 작성해야 합니다.

모든 장표에 다음과 같은 고정 장면을 반복하지 마세요.

- modern commercial interior
- large digital advertising screen
- several people walking past
- generic office
- generic city street
- generic data dashboard
- generic billboard scene

장표의 제목과 본문이 달라지면
피사체, 공간, 행동, 구도, 카메라 거리, 시간대도 달라져야 합니다.

이미지는 설명용 아이콘이나 인포그래픽보다
실제 상황을 촬영한 듯한 photorealistic editorial photography를 우선하세요.

각 프롬프트에는 필요한 경우 다음 내용을 구체적으로 포함하세요.

- 핵심 피사체
- 피사체가 하는 행동
- 구체적인 장소
- 시간대
- 카메라 거리
- 카메라 각도
- 인물의 위치
- 시선 방향
- 감정 또는 상황
- 조명
- 사진 분위기
- 제목을 배치할 여백 위치

장표마다 구도를 다양하게 선택하세요.

예:

- close-up
- medium shot
- wide environmental shot
- over-the-shoulder
- low angle
- high angle
- side profile
- foreground and background contrast
- shallow depth of field
- symmetrical composition
- asymmetrical editorial composition

단, 장표의 의미와 맞지 않는 구도를 억지로 사용하지 마세요.

────────────────────────
[문자 생성 위험 장면 금지]
────────────────────────

이미지에 글자가 필요하지 않은 장표에서는
문자가 발생할 가능성이 높은 장면과 표현을 피하세요.

다음 요소를 정면 또는 선명하게 보여주지 마세요.

- 상점 간판
- 식당 간판
- 병원 간판
- 학교 간판
- 은행 간판
- 매장 이름
- 옥외 광고판
- 디지털 광고판
- 메뉴판
- 포스터
- 전단지
- 도로 표지판
- 안내판
- 상품 포장지
- 글자가 있는 의류
- 차량 번호판
- 브랜드 로고
- 이름표
- 명함
- 휴대전화 화면의 글자
- 컴퓨터 화면의 글자
- 데이터 화면의 숫자와 문구

단순히 프롬프트 마지막에 "no text"만 추가하지 마세요.

장면 자체에서 문자가 생길 장소를 제거해야 합니다.

문자가 생길 수 있는 공간이 필요한 경우 반드시 다음 중 하나로 표현하세요.

- signboards completely outside the frame
- plain unmarked building facades
- blank architectural panels
- unmarked glass storefront windows
- signs viewed only from the back
- sign-shaped objects heavily blurred
- signage fully obscured by architecture
- all display surfaces completely blank
- people and behavior shown in medium or close framing
- text-bearing objects cropped outside the composition

다음 표현은 가급적 사용하지 마세요.

- outdoor advertisements
- outdoor advertising signs
- billboards
- signage
- storefront signs
- restaurant sign
- hospital sign
- shop signs
- advertising posters
- commercial signs
- branded products
- visible menus
- readable displays

이런 표현이 장표 의미상 꼭 필요하다면 다음처럼 바꾸세요.

잘못된 예:
"a restaurant and a hospital visible"

수정 예:
"modern commercial buildings with plain unmarked facades"

잘못된 예:
"people engaging with outdoor advertisements"

수정 예:
"people pausing near a blank architectural display surface,
with attention conveyed through posture and gaze"

잘못된 예:
"busy street filled with shop signs"

수정 예:
"pedestrians moving through a modern commercial district,
with unmarked glass storefronts and plain building facades"

잘못된 예:
"a large digital billboard showing an advertisement"

수정 예:
"a large blank illuminated display surface,
with no graphics, no letters and no symbols"

────────────────────────
[인물 행동으로 광고 관심 표현]
────────────────────────

광고나 매장에 대한 관심을 표현할 때
글자가 있는 광고판을 직접 보여주는 대신 인물의 행동으로 표현하세요.

활용 가능한 장면:

- 한 사람이 걷다가 잠시 멈추는 모습
- 유리창 안쪽을 바라보는 사람의 뒷모습
- 고개를 돌려 특정 방향을 보는 행인
- 여러 사람 중 한 사람만 관심을 보이는 장면
- 매장 입구 앞에서 고민하는 사람
- 시선 방향이 분명한 옆모습
- 화면 밖 대상에 반응하는 인물
- 전경과 배경의 행동 차이
- 지나치는 사람과 멈춘 사람의 대비

광고 내용을 직접 보여주기보다,
사람이 얼마나 관심을 보이는지를 행동과 구도로 표현하세요.

────────────────────────
[영문 텍스트 허용 조건]
────────────────────────

이미지 안에 영어 텍스트가 반드시 필요한 경우에만
짧은 영문 1개를 따옴표로 명확하게 지정할 수 있습니다.

예:

A single clean sign displaying exactly "INWAVE"

영어 텍스트 사용 규칙:

- 최대 1~3단어
- 짧고 쉬운 영어만 사용
- 정확한 문구를 큰따옴표로 표시
- displaying exactly "TEXT" 형식 권장
- 한 장면에 영어 문구 1개만 허용
- 나머지 간판과 글자는 모두 제거
- 긴 문장 금지
- 여러 간판에 서로 다른 문구 금지
- 한글을 이미지 안에 생성하도록 요청하지 않기

영문 텍스트가 필요하지 않다면
따옴표로 된 영어 문구를 프롬프트에 넣지 마세요.

────────────────────────
[englishImagePrompt 필수 조건]
────────────────────────

모든 영문 이미지 프롬프트에는 다음 조건을 포함하세요.

- vertical 4:5 Instagram composition
- photorealistic
- editorial or documentary advertising photography
- one coherent photographic scene
- no visible text
- no readable text
- no pseudo-text
- no fake letters
- no invented writing
- no Korean characters
- no Chinese characters
- no Japanese characters
- no logos
- no watermark
- no UI overlay
- no infographic
- no split screen
- no collage

단, 짧은 영어 문구 1개를 의도적으로 요청한 경우에는
그 문구만 예외로 허용하고 나머지 글자는 모두 금지하세요.

────────────────────────
[이미지 프롬프트 최종 점검]
────────────────────────

englishImagePrompt를 작성한 후 반드시 스스로 점검하세요.

1. 이 프롬프트에 식당, 병원, 상점, 광고판, 메뉴판, 포스터가 들어가 있는가?
2. 정면으로 보이는 간판이나 표지판이 있는가?
3. AI가 가짜 글자를 만들 만한 면적이 있는가?
4. outdoor advertisements, signage, billboard 같은 위험 표현이 있는가?
5. 글자를 직접 보여주지 않고 인물 행동으로 의미를 전달할 수 있는가?
6. 모든 간판과 글자 영역을 blank, unmarked, blurred, obscured, outside the frame 중 하나로 통제했는가?
7. 장표 제목과 본문을 실제로 표현하는 장면인가?
8. 앞 장표와 거의 같은 거리 장면을 반복하고 있지는 않은가?

문자 위험 요소가 발견되면 프롬프트를 다시 작성한 뒤 반환하세요.

────────────────────────
[응답 규칙]
────────────────────────

반드시 지정된 JSON 스키마에 맞는 데이터만 반환하세요.
마크다운, 코드블록, 추가 설명은 반환하지 마세요.
`;

  const responseSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "isComplete",
      "chatReply",
      "storyboard"
    ],

    properties: {
      isComplete: {
        type: "boolean",
        description: "카드뉴스 기획 완료 여부"
      },

      chatReply: {
        type: "string",
        description: "사용자에게 보여줄 대화 응답"
      },

      storyboard: {
        type: "object",
        additionalProperties: false,
        required: ["pages"],

        properties: {
          pages: {
            type: "array",
            description:
              "미완료 시 빈 배열, 완료 시 3~5장의 카드뉴스 장표",
            maxItems: 5,

            items: {
              type: "object",
              additionalProperties: false,

              required: [
                "pageNumber",
                "role",
                "label",
                "title",
                "body",
                "koreanPromptSummary",
                "englishImagePrompt"
              ],

              properties: {
                pageNumber: {
                  type: "integer",
                  description: "1부터 시작하는 장표 번호"
                },

                role: {
                  type: "string",
                  description:
                    "해당 장표가 전체 흐름에서 담당하는 역할"
                },

                label: {
                  type: "string",
                  description:
                    "장표 상단에 표시할 짧은 한국어 라벨"
                },

                title: {
                  type: "string",
                  description:
                    "카드뉴스에 실제로 표시할 한국어 제목"
                },

                body: {
                  type: "string",
                  description:
                    "장표 제목을 설명하는 한국어 본문"
                },

                koreanPromptSummary: {
                  type: "string",
                  description:
                    "사용자가 이미지 장면을 이해할 수 있는 한국어 한 문장"
                },

                englishImagePrompt: {
                  type: "string",
                  description:
                    "문자 위험 장면을 제거한 장표 전용 영문 이미지 생성 프롬프트"
                }
              }
            }
          }
        }
      }
    }
  };

  try {
    const model =
      process.env.OPENAI_TEXT_MODEL?.trim() ||
      "gpt-4.1-mini";

    console.log("OpenAI 텍스트 모델:", model);
    console.log("전달된 대화 수:", safeMessages.length);

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            ...safeMessages
          ],

          response_format: {
            type: "json_schema",

            json_schema: {
              name: "inwave_carousel_plan",
              strict: true,
              schema: responseSchema
            }
          },

          temperature: 0.6
        })
      }
    );

    const rawResponse =
      await openAIResponse.text();

    let openAIData;

    try {
      openAIData = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error(
        "OpenAI 원본 응답:",
        rawResponse
      );

      console.error(
        "OpenAI 응답 JSON 변환 오류:",
        parseError
      );

      return res.status(502).json({
        error:
          "OpenAI 응답을 JSON으로 읽지 못했습니다.",
        detail: rawResponse.slice(0, 1000)
      });
    }

    if (!openAIResponse.ok) {
      const apiError =
        openAIData?.error?.message ||
        `OpenAI API 요청 실패: HTTP ${openAIResponse.status}`;

      console.error(
        "OpenAI API 오류:",
        openAIData
      );

      return res
        .status(openAIResponse.status)
        .json({
          error: apiError,
          detail: openAIData
        });
    }

    const message =
      openAIData?.choices?.[0]?.message;

    if (message?.refusal) {
      console.error(
        "OpenAI 응답 거절:",
        message.refusal
      );

      return res.status(422).json({
        error:
          "OpenAI가 해당 요청의 처리를 거절했습니다.",
        detail: message.refusal
      });
    }

    const resultText =
      message?.content;

    if (
      !resultText ||
      typeof resultText !== "string"
    ) {
      console.error(
        "OpenAI content 없음:",
        openAIData
      );

      return res.status(502).json({
        error:
          "OpenAI 응답에 content가 없습니다.",
        detail: openAIData
      });
    }

    let result;

    try {
      result = JSON.parse(resultText);
    } catch (parseError) {
      console.error(
        "OpenAI content 원본:",
        resultText
      );

      console.error(
        "스토리보드 JSON 변환 오류:",
        parseError
      );

      return res.status(502).json({
        error:
          "OpenAI 기획 결과를 JSON으로 변환하지 못했습니다.",
        detail: resultText.slice(0, 1000)
      });
    }

    if (
      typeof result.isComplete !== "boolean" ||
      typeof result.chatReply !== "string" ||
      !result.storyboard ||
      !Array.isArray(result.storyboard.pages)
    ) {
      console.error(
        "OpenAI 응답 구조 오류:",
        result
      );

      return res.status(502).json({
        error:
          "OpenAI 응답 구조가 올바르지 않습니다.",
        detail: result
      });
    }

    if (
      result.isComplete &&
      result.storyboard.pages.length === 0
    ) {
      console.error(
        "완료 상태지만 장표가 없음:",
        result
      );

      return res.status(502).json({
        error:
          "기획 완료 응답은 받았지만 생성된 장표가 없습니다."
      });
    }

    if (result.isComplete) {
      result.storyboard.pages =
        result.storyboard.pages.map(
          (page, index) => ({
            ...page,
            pageNumber: index + 1
          })
        );
    }

    return res
      .status(200)
      .json(result);
  } catch (error) {
    console.error(
      "plan-carousel 서버 오류:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "스토리보드 생성 중 서버 오류가 발생했습니다."
    });
  }
}
