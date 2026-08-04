/**
 * api/generate-images.js
 *
 * INWAVE 카드뉴스 이미지 생성 API
 * - FAL 지원
 * - Replicate 지원
 * - 기본적으로 이미지 내부의 모든 글자 제거
 * - 프롬프트에 짧은 영어 문구를 따옴표로 지정한 경우만 허용
 *
 * 예:
 * A storefront sign displaying exactly "INWAVE"
 *
 * 위와 같이 입력하면 INWAVE만 이미지 내부 텍스트로 허용합니다.
 */

export const maxDuration = 300;

import { fal } from "@fal-ai/client";

/**
 * FAL 인증
 */
fal.config({
  credentials: process.env.FAL_KEY
});

/**
 * 지원하는 디자인 콘셉트
 */
const VALID_CONCEPTS = [
  "hook",
  "insight",
  "magazine"
];

const CONCEPT_ALIASES = {
  hook: "hook",
  insight: "insight",
  magazine: "magazine",
  "강한 후킹형": "hook",
  "전문 인사이트형": "insight",
  "트렌드 매거진형": "magazine"
};

/**
 * 콘셉트별 공통 사진 방향
 *
 * 특정 장소나 피사체를 고정하지 않고,
 * 장표에서 전달된 프롬프트를 우선하도록 구성합니다.
 */
const CONCEPT_PROMPTS = {
  hook: `
Visual direction:
High-impact editorial advertising photography.
Strong visual hierarchy and immediate thumbnail impact.
Bold but realistic lighting.
One clearly identifiable main subject.
The scene should create curiosity without looking artificial,
sensational, exaggerated or like generic stock photography.
`,

  insight: `
Visual direction:
Professional editorial and documentary advertising photography.
Credible, sophisticated and analytical atmosphere.
Natural navy, ivory and warm orange accents when appropriate.
Clear visual storytelling suitable for a professional marketing insight publication.
`,

  magazine: `
Visual direction:
Premium contemporary magazine photography.
Refined, stylish and cinematic while remaining realistic.
Thoughtful composition, natural texture and subtle visual tension.
Modern editorial sensibility without looking like generic stock photography.
`
};

/**
 * 공급자별 생성 장수 정규화
 *
 * 현재 화면에서 공급자별 최대 2장까지 선택하도록 구성돼 있습니다.
 */
function normalizeProviderCount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(Math.floor(number), 2)
  );
}

/**
 * 사용자 프롬프트 정리
 */
function normalizePrompt(prompt) {
  return String(prompt || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 12000);
}

/**
 * 프롬프트 안에 허용할 짧은 영어 문구가 있는지 확인
 *
 * 다음과 같은 형식을 우선 감지합니다.
 *
 * displaying exactly "INWAVE"
 * text exactly "OPEN"
 * sign reading "INWAVE"
 * the word "INWAVE"
 *
 * 일반적인 따옴표 문구도 짧은 영문일 경우 감지합니다.
 */
function extractRequestedEnglishText(prompt) {
  const source = normalizePrompt(prompt);

  if (!source) {
    return null;
  }

  const explicitPatterns = [
    /display(?:ing|s)?\s+exactly\s*[:\-]?\s*["“']([^"”']+)["”']/i,
    /text\s+exactly\s*[:\-]?\s*["“']([^"”']+)["”']/i,
    /sign\s+(?:reading|displaying|showing)\s*[:\-]?\s*["“']([^"”']+)["”']/i,
    /the\s+(?:word|words|phrase|text)\s*[:\-]?\s*["“']([^"”']+)["”']/i,
    /write\s+exactly\s*[:\-]?\s*["“']([^"”']+)["”']/i
  ];

  for (const pattern of explicitPatterns) {
    const match = source.match(pattern);

    if (match?.[1]) {
      const result = validateEnglishText(match[1]);

      if (result) {
        return result;
      }
    }
  }

  /**
   * 명시적 표현이 없더라도 따옴표 안에 짧은 영어가 있으면 감지
   */
  const quotedMatches = [
    ...source.matchAll(/["“']([^"”']+)["”']/g)
  ];

  for (const match of quotedMatches) {
    const result = validateEnglishText(match?.[1]);

    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * 이미지 안에 넣을 수 있는 영어 문구인지 검사
 *
 * 너무 긴 문장이나 한글이 섞인 문장은 허용하지 않습니다.
 * 영어 단어, 숫자 및 기본 문장부호만 허용합니다.
 */
function validateEnglishText(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  /**
   * 한글, 한자, 일본어 문자가 들어가면 이미지 내부 문구로 사용하지 않음
   */
  if (
    /[\u3131-\u318E\uAC00-\uD7A3]/.test(text) ||
    /[\u3400-\u9FFF]/.test(text) ||
    /[\u3040-\u30FF]/.test(text)
  ) {
    return null;
  }

  /**
   * 영어, 숫자, 공백, 일부 기본 기호만 허용
   */
  if (!/^[A-Za-z0-9\s&+\-'.!,?]+$/.test(text)) {
    return null;
  }

  /**
   * 너무 긴 문구는 생성 정확도가 크게 낮아지므로 제한
   */
  if (text.length > 35) {
    return null;
  }

  const wordCount = text
    .split(/\s+/)
    .filter(Boolean)
    .length;

  if (wordCount > 5) {
    return null;
  }

  return text;
}

/**
 * 영어 텍스트를 프롬프트에 안전하게 삽입
 */
function escapePromptText(value) {
  return String(value || "")
    .replace(/\\/g, "")
    .replace(/"/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 글자가 전혀 필요하지 않은 이미지의 문자 방지 지침
 */
function buildNoTextInstruction() {
  return `
STRICT TEXT EXCLUSION:

- no visible or readable text anywhere in the image
- no Korean characters
- no Chinese characters
- no Japanese characters
- no English letters
- no alphabet
- no numbers
- no pseudo-text
- no fake letters
- no invented writing
- no decorative writing
- no symbols resembling written language
- no typography
- no captions
- no logos
- no brand names
- no watermark
- no UI overlay

ENVIRONMENT CONTROL:

- all storefront signs must be completely blank
- all signboards must be blank, heavily blurred, physically covered, turned away from the camera, hidden by architecture, or outside the frame
- all menus must be blank or unreadable
- all posters and billboards must be blank or outside the frame
- all product packages must have plain unbranded surfaces
- all clothing must be free of writing and logos
- do not invent fake Asian writing
- do not create Chinese-looking, Korean-looking or Japanese-looking pseudo-characters
- prioritize people, architecture, lighting, products and atmosphere instead of signage
`;
}

/**
 * 짧은 영어 텍스트가 요청된 이미지의 문자 지침
 *
 * 요청한 영어 문구 1개만 허용합니다.
 */
function buildExactEnglishInstruction(requestedText) {
  const safeText = escapePromptText(requestedText);

  return `
CONTROLLED ENGLISH TEXT RENDERING:

The image may contain one short English text element.

The exact permitted text is:

"${safeText}"

Text requirements:

- display exactly "${safeText}"
- preserve the exact spelling
- preserve the exact word order
- do not translate it
- do not add extra words
- do not remove letters
- do not replace letters
- do not repeat the text
- use large, clear and simple sans-serif lettering
- place the text on one clean sign or one simple display surface
- the text must be front-facing
- the text must be easy to read
- the sign must not be distorted
- the sign must not be hidden by people or objects
- use strong contrast between the letters and the sign background

All other writing is prohibited:

- no Korean characters
- no Chinese characters
- no Japanese characters
- no additional English words
- no additional letters
- no additional numbers
- no pseudo-text
- no fake alphabet
- no invented writing
- no decorative lettering
- no logos
- no brand marks
- no watermark
- no captions
- no UI overlay

All other signs, menus, posters, billboards, products and clothing must be blank,
heavily blurred, turned away, physically covered, cropped outside the frame,
or completely free of writing.

Do not create fake Asian characters anywhere in the scene.
`;
}

/**
 * 사용자 장표 프롬프트와 선택 콘셉트 결합
 *
 * 따옴표 안에 짧은 영어가 있으면 영어 텍스트 모드,
 * 그렇지 않으면 완전한 텍스트 제거 모드로 동작합니다.
 */
function buildCompositionInstruction(imageComposition = {}, role = "insight") {
  const reservedTextArea = String(imageComposition?.reservedTextArea || "lower-left");
  const subjectPosition = String(imageComposition?.subjectPosition || "right-center");
  const cameraShot = String(imageComposition?.cameraShot || "medium-wide");
  const backgroundDensity = String(imageComposition?.backgroundDensity || "low");

  const areaMap = {
    "upper-left": "upper-left 40 percent",
    "upper-center": "upper-center 45 percent",
    "upper-right": "upper-right 40 percent",
    "middle-left": "middle-left 40 percent",
    "middle-right": "middle-right 40 percent",
    "lower-left": "lower-left 40 percent",
    "lower-center": "lower-center 45 percent",
    "lower-right": "lower-right 40 percent"
  };

  return `
PLANNED CARD LAYOUT:
- page role: ${role}
- camera shot: ${cameraShot}
- place the main subject around the ${subjectPosition}
- reserve a clean, low-detail, visually calm area occupying approximately the ${areaMap[reservedTextArea] || areaMap["lower-left"]} for a Korean headline that will be added later
- keep faces, hands, phones, products and important actions completely outside the reserved text area
- background density in the reserved text area must be ${backgroundDensity}
- do not place bright highlights, high-contrast edges or important objects in the reserved text area
`;
}

function buildFinalPrompt(prompt, concept, imageComposition = {}, role = "insight") {
  const safePrompt = normalizePrompt(prompt);

  const requestedConcept =
    String(concept || "").trim();

  const normalizedConcept =
    CONCEPT_ALIASES[requestedConcept] ||
    (
      VALID_CONCEPTS.includes(
        requestedConcept
      )
        ? requestedConcept
        : "hook"
    );

  const requestedEnglishText =
    extractRequestedEnglishText(safePrompt);

  const textInstruction =
    requestedEnglishText
      ? buildExactEnglishInstruction(
          requestedEnglishText
        )
      : buildNoTextInstruction();

  const finalPrompt = `
PRIMARY SCENE INSTRUCTION:

${safePrompt}

IMPORTANT PRIORITY:

- preserve the specific subject described in the primary scene instruction
- preserve the requested action
- preserve the requested location
- preserve the requested camera angle
- preserve the requested camera distance
- preserve the requested subject placement
- preserve the requested negative space
- do not replace the scene with a generic office
- do not replace the scene with a generic city street
- do not automatically add digital signage
- do not automatically add billboards
- do not automatically add storefront signs

${CONCEPT_PROMPTS[normalizedConcept]}

${buildCompositionInstruction(imageComposition, role)}

GENERAL IMAGE REQUIREMENTS:

- vertical 4:5 Instagram composition
- photorealistic
- realistic editorial or documentary advertising photography
- one coherent photographic scene
- one clearly understandable visual message
- natural human anatomy when people are present
- realistic hands and faces when visible
- realistic architecture
- realistic lighting
- sufficient clarity at social-media thumbnail size
- no infographic
- no chart
- no diagram
- no split screen
- no collage
- no poster layout
- no decorative frame
- no border

${textInstruction}
`.trim();

  return {
    finalPrompt,
    requestedEnglishText,
    textMode: requestedEnglishText
      ? "exact-english"
      : "no-text"
  };
}

/**
 * 생성 결과를 프런트엔드가 사용하는 공통 형식으로 변환
 */
function createImageResult(
  provider,
  url,
  index
) {
  return {
    id: `${provider}-${Date.now()}-${index}`,
    provider,
    imageUrl: url
  };
}

/**
 * FAL 이미지 생성
 */
async function generateFalImages(
  finalPrompt,
  count
) {
  if (count <= 0) {
    return [];
  }

  if (!process.env.FAL_KEY) {
    throw new Error(
      "Vercel에 FAL_KEY가 설정되지 않았습니다."
    );
  }

  /**
   * Vercel의 FAL_MODEL을 우선 사용
   */
  const falModel =
    process.env.FAL_MODEL?.trim() ||
    "fal-ai/flux/dev";

  console.log("FAL 모델:", falModel);
  console.log("FAL 생성 장수:", count);

  const result = await fal.subscribe(
    falModel,
    {
      input: {
        prompt: finalPrompt,

        image_size: {
          width: 1080,
          height: 1350
        },

        num_images: count,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        enable_safety_checker: true,
        output_format: "jpeg"
      },

      logs: true,

      onQueueUpdate(update) {
        if (
          update?.status ===
          "IN_PROGRESS"
        ) {
          const messages =
            Array.isArray(update.logs)
              ? update.logs
                  .map(
                    (log) =>
                      log?.message
                  )
                  .filter(Boolean)
              : [];

          if (messages.length > 0) {
            console.log(
              "FAL 진행 상태:",
              messages[
                messages.length - 1
              ]
            );
          }
        }
      }
    }
  );

  const rawImages =
    result?.data?.images;

  if (!Array.isArray(rawImages)) {
    console.error(
      "FAL 전체 응답:",
      result
    );

    throw new Error(
      "FAL 응답에 images 배열이 없습니다."
    );
  }

  const images = rawImages
    .map((item, index) => {
      const url =
        typeof item === "string"
          ? item
          : item?.url;

      if (
        typeof url !== "string" ||
        !url.startsWith("http")
      ) {
        return null;
      }

      return createImageResult(
        "fal",
        url,
        index
      );
    })
    .filter(Boolean);

  if (images.length === 0) {
    console.error(
      "FAL 이미지 결과 없음:",
      result
    );

    throw new Error(
      "FAL에서 생성된 이미지 URL을 받지 못했습니다."
    );
  }

  return images;
}

/**
 * Replicate 모델 값 분석
 *
 * 지원 형식:
 *
 * owner/model
 * owner/model:versionId
 * versionId
 */
function parseReplicateModel(
  modelValue
) {
  const fallback =
    "black-forest-labs/flux-schnell";

  const model = String(
    modelValue || fallback
  ).trim();

  /**
   * 64자리 버전 ID
   */
  if (/^[a-f0-9]{64}$/i.test(model)) {
    return {
      type: "version",
      version: model
    };
  }

  /**
   * owner/model:versionId
   */
  if (model.includes(":")) {
    const separatorIndex =
      model.indexOf(":");

    const modelPath = model
      .slice(0, separatorIndex)
      .trim();

    const version = model
      .slice(separatorIndex + 1)
      .trim();

    const [owner, name] =
      modelPath.split("/");

    if (
      owner &&
      name &&
      /^[a-f0-9]{64}$/i.test(version)
    ) {
      return {
        type: "version",
        owner,
        name,
        version
      };
    }
  }

  /**
   * 공식 모델 owner/model
   */
  const [owner, name] =
    model.split("/");

  if (owner && name) {
    return {
      type: "official",
      owner,
      name
    };
  }

  return {
    type: "official",
    owner: "black-forest-labs",
    name: "flux-schnell"
  };
}

/**
 * Replicate Prediction 생성
 */
async function createReplicatePrediction(
  modelInfo,
  finalPrompt
) {
  let endpoint;
  let requestBody;

  if (modelInfo.type === "version") {
    endpoint =
      "https://api.replicate.com/v1/predictions";

    requestBody = {
      version: modelInfo.version,

      input: {
        prompt: finalPrompt,
        aspect_ratio: "4:5",
        output_format: "jpg",
        output_quality: 90
      }
    };
  } else {
    endpoint =
      `https://api.replicate.com/v1/models/` +
      `${encodeURIComponent(
        modelInfo.owner
      )}/` +
      `${encodeURIComponent(
        modelInfo.name
      )}/predictions`;

    requestBody = {
      input: {
        prompt: finalPrompt,
        aspect_ratio: "4:5",
        output_format: "jpg",
        output_quality: 90
      }
    };
  }

  const response = await fetch(
    endpoint,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${process.env.REPLICATE_API_TOKEN}`,

        "Content-Type":
          "application/json",

        /**
         * Replicate 동기 대기는 최대 60초
         */
        Prefer: "wait=60"
      },

      body: JSON.stringify(
        requestBody
      )
    }
  );

  const rawResponse =
    await response.text();

  let data;

  try {
    data = JSON.parse(rawResponse);
  } catch {
    console.error(
      "Replicate 비정상 응답:",
      rawResponse
    );

    throw new Error(
      "Replicate 응답을 JSON으로 읽지 못했습니다."
    );
  }

  if (!response.ok) {
    console.error(
      "Replicate API 오류:",
      data
    );

    throw new Error(
      data?.detail ||
        data?.error ||
        `Replicate 요청 실패: HTTP ${response.status}`
    );
  }

  return data;
}

/**
 * 지정 시간 대기
 */
function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Replicate 이미지 생성이 완료될 때까지 상태 조회
 */
async function waitForReplicatePrediction(
  prediction
) {
  let current = prediction;

  /**
   * 5초 간격으로 최대 20회 조회
   * 약 100초 추가 대기
   */
  for (
    let attempt = 0;
    attempt < 20;
    attempt += 1
  ) {
    if (
      current?.status ===
      "succeeded"
    ) {
      return current;
    }

    if (
      current?.status === "failed" ||
      current?.status === "canceled"
    ) {
      throw new Error(
        current?.error ||
          `Replicate 작업이 ${current.status} 상태로 종료됐습니다.`
      );
    }

    const statusUrl =
      current?.urls?.get;

    if (!statusUrl) {
      throw new Error(
        "Replicate 결과 조회 주소가 없습니다."
      );
    }

    await sleep(5000);

    const response = await fetch(
      statusUrl,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${process.env.REPLICATE_API_TOKEN}`,

          "Content-Type":
            "application/json"
        }
      }
    );

    const rawResponse =
      await response.text();

    let data;

    try {
      data = JSON.parse(
        rawResponse
      );
    } catch {
      console.error(
        "Replicate 상태 응답:",
        rawResponse
      );

      throw new Error(
        "Replicate 진행 상태를 JSON으로 읽지 못했습니다."
      );
    }

    if (!response.ok) {
      console.error(
        "Replicate 상태 조회 오류:",
        data
      );

      throw new Error(
        data?.detail ||
          data?.error ||
          "Replicate 진행 상태 조회에 실패했습니다."
      );
    }

    current = data;

    console.log(
      "Replicate 상태:",
      current?.status
    );
  }

  throw new Error(
    "Replicate 이미지 생성 대기 시간이 초과됐습니다."
  );
}

/**
 * Replicate output에서 이미지 URL 추출
 */
function extractReplicateUrls(output) {
  if (typeof output === "string") {
    return output.startsWith("http")
      ? [output]
      : [];
  }

  if (Array.isArray(output)) {
    return output.filter(
      (item) =>
        typeof item === "string" &&
        item.startsWith("http")
    );
  }

  /**
   * 일부 모델의 객체 형태 결과 처리
   */
  if (
    output &&
    typeof output === "object"
  ) {
    const possibleUrls = [
      output.url,
      output.image,
      output.imageUrl,
      output.output
    ];

    return possibleUrls.filter(
      (item) =>
        typeof item === "string" &&
        item.startsWith("http")
    );
  }

  return [];
}

/**
 * Replicate 이미지 생성
 */
async function generateReplicateImages(
  finalPrompt,
  count
) {
  if (count <= 0) {
    return [];
  }

  if (
    !process.env
      .REPLICATE_API_TOKEN
  ) {
    throw new Error(
      "Vercel에 REPLICATE_API_TOKEN이 설정되지 않았습니다."
    );
  }

  const modelInfo =
    parseReplicateModel(
      process.env.REPLICATE_MODEL
    );

  console.log(
    "Replicate 모델:",
    process.env.REPLICATE_MODEL ||
      "black-forest-labs/flux-schnell"
  );

  console.log(
    "Replicate 생성 장수:",
    count
  );

  const images = [];

  /**
   * UI에서 2장을 선택하면 2회 요청
   */
  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    let prediction =
      await createReplicatePrediction(
        modelInfo,
        finalPrompt
      );

    if (
      prediction?.status ===
        "starting" ||
      prediction?.status ===
        "processing"
    ) {
      prediction =
        await waitForReplicatePrediction(
          prediction
        );
    }

    if (
      prediction?.status ===
      "failed"
    ) {
      throw new Error(
        prediction?.error ||
          "Replicate 이미지 생성에 실패했습니다."
      );
    }

    const urls =
      extractReplicateUrls(
        prediction?.output
      );

    if (urls.length === 0) {
      console.error(
        "Replicate 결과 URL 없음:",
        prediction
      );

      throw new Error(
        `Replicate 이미지 결과가 없습니다. 현재 상태: ${
          prediction?.status ||
          "알 수 없음"
        }`
      );
    }

    urls.forEach(
      (url, outputIndex) => {
        images.push(
          createImageResult(
            "replicate",
            url,
            `${index}-${outputIndex}`
          )
        );
      }
    );
  }

  return images;
}

/**
 * API 메인 핸들러
 */
export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  if (req.method !== "POST") {
    return res.status(405).json({
      error:
        "POST 요청만 사용할 수 있습니다."
    });
  }

  const {
    prompt,
    concept = "hook",
    providers = {},
    imageComposition = {},
    role = "insight"
  } = req.body || {};

  const sourcePrompt =
    normalizePrompt(prompt);

  if (!sourcePrompt) {
    return res.status(400).json({
      error:
        "이미지 생성 프롬프트가 없습니다."
    });
  }

  const normalizedProviders = {
    fal: normalizeProviderCount(
      providers?.fal
    ),

    replicate:
      normalizeProviderCount(
        providers?.replicate
      )
  };

  const totalSelected =
    normalizedProviders.fal +
    normalizedProviders.replicate;

  if (totalSelected <= 0) {
    return res.status(400).json({
      error:
        "FAL 또는 Replicate에서 최소 1장 이상 선택해 주세요."
    });
  }

  if (totalSelected > 4) {
    return res.status(400).json({
      error:
        "한 번에 생성할 수 있는 이미지는 최대 4장입니다."
    });
  }

  /**
   * 영어 문구 감지 및 최종 프롬프트 구성
   */
  const {
    finalPrompt,
    requestedEnglishText,
    textMode
  } = buildFinalPrompt(
    sourcePrompt,
    concept,
    imageComposition,
    role
  );

  console.log(
    "이미지 텍스트 모드:",
    textMode
  );

  if (requestedEnglishText) {
    console.log(
      "요청된 영어 텍스트:",
      requestedEnglishText
    );
  }

  const tasks = [];
  const images = [];
  const providerErrors = [];

  /**
   * FAL 생성 작업
   */
  if (
    normalizedProviders.fal > 0
  ) {
    tasks.push(
      generateFalImages(
        finalPrompt,
        normalizedProviders.fal
      )
        .then((result) => {
          images.push(...result);
        })
        .catch((error) => {
          console.error(
            "FAL 생성 오류:",
            error
          );

          providerErrors.push({
            provider: "fal",

            message:
              error instanceof Error
                ? error.message
                : "FAL 이미지 생성 오류"
          });
        })
    );
  }

  /**
   * Replicate 생성 작업
   */
  if (
    normalizedProviders.replicate >
    0
  ) {
    tasks.push(
      generateReplicateImages(
        finalPrompt,
        normalizedProviders.replicate
      )
        .then((result) => {
          images.push(...result);
        })
        .catch((error) => {
          console.error(
            "Replicate 생성 오류:",
            error
          );

          providerErrors.push({
            provider: "replicate",

            message:
              error instanceof Error
                ? error.message
                : "Replicate 이미지 생성 오류"
          });
        })
    );
  }

  try {
    await Promise.all(tasks);

    if (images.length === 0) {
      return res.status(500).json({
        error:
          "선택한 이미지 API에서 생성된 이미지가 없습니다.",

        providerErrors,

        textMode,

        requestedEnglishText:
          requestedEnglishText || null
      });
    }

    return res.status(200).json({
      success: true,

      images,

      providerErrors,

      /**
       * no-text:
       * 이미지 안의 모든 글자를 제거하도록 요청
       *
       * exact-english:
       * 따옴표로 지정한 짧은 영어만 허용
       */
      textMode,

      requestedEnglishText:
        requestedEnglishText || null,

      /**
       * 현재는 디버깅을 위해 반환합니다.
       * 정상 동작 확인 후 외부 노출이 싫다면
       * finalPrompt 줄을 삭제해도 됩니다.
       */
      finalPrompt
    });
  } catch (error) {
    console.error(
      "generate-images 서버 오류:",
      error
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "이미지 생성 중 서버 오류가 발생했습니다.",

      providerErrors
    });
  }
}
