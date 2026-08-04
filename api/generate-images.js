/**
 * api/generate-images.js
 *
 * INWAVE 카드뉴스 이미지 생성 API
 * FAL + Replicate 지원
 * Vercel Serverless Function
 */

import { fal } from "@fal-ai/client";

/*
 * FAL 인증 설정
 * Vercel 환경변수 FAL_KEY 사용
 */
fal.config({
  credentials: process.env.FAL_KEY
});

const VALID_CONCEPTS = [
  "hook",
  "insight",
  "magazine"
];

const CONCEPT_PROMPTS = {
  hook: `
Visual direction:
High-impact editorial advertising photography.
Strong visual hierarchy and immediate thumbnail impact.
Bold but realistic lighting.
A clearly identifiable main subject.
The scene should create curiosity without looking sensational or artificial.
`,

  insight: `
Visual direction:
Professional editorial and documentary advertising photography.
Credible, sophisticated and analytical atmosphere.
Natural navy, ivory and warm orange accents when appropriate.
Clear visual storytelling suitable for a marketing insight publication.
`,

  magazine: `
Visual direction:
Premium contemporary magazine photography.
Refined, stylish and cinematic but still realistic.
Thoughtful composition, natural texture and subtle visual tension.
Modern editorial sensibility without looking like generic stock photography.
`
};

/**
 * 생성 장수 정규화
 * 공급자별 최대 2장
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
 * 프롬프트 정리
 */
function normalizePrompt(prompt) {
  return String(prompt || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 12000);
}

/**
 * 장표 프롬프트와 선택 콘셉트 결합
 *
 * 지나치게 구체적인 공통 장소나 피사체를 강제로 넣지 않고,
 * 사용자가 받은 장표별 프롬프트를 가장 우선합니다.
 */
function buildFinalPrompt(prompt, concept) {
  const safePrompt = normalizePrompt(prompt);

  const normalizedConcept =
    VALID_CONCEPTS.includes(concept)
      ? concept
      : "hook";

  return `
PRIMARY SCENE INSTRUCTION:

${safePrompt}

${CONCEPT_PROMPTS[normalizedConcept]}

Final image requirements:

- vertical 4:5 Instagram composition
- photorealistic
- realistic editorial or documentary advertising photography
- preserve the specific subject, action, location and composition described in the primary scene instruction
- do not replace the requested scene with a generic office, generic city street or generic digital signage scene
- one coherent photographic scene
- natural human anatomy when people are present
- realistic hands and faces when visible
- sufficient visual clarity at social-media thumbnail size
- preserve intentional negative space only when requested in the primary scene instruction
- no visible text
- no Korean characters
- no English letters
- no typography
- no captions
- no logos
- no watermark
- no UI overlay
- no charts
- no infographic
- no split screen
- no collage
- no poster frame
- no decorative border
`.trim();
}

/**
 * 결과 URL을 공통 형식으로 변환
 */
function createImageResult(provider, url, index) {
  return {
    id: `${provider}-${Date.now()}-${index}`,
    provider,
    imageUrl: url
  };
}

/**
 * FAL 이미지 생성
 */
async function generateFalImages(finalPrompt, count) {
  if (count <= 0) {
    return [];
  }

  if (!process.env.FAL_KEY) {
    throw new Error(
      "Vercel에 FAL_KEY가 설정되지 않았습니다."
    );
  }

  /*
   * Vercel에 설정된 FAL_MODEL을 우선 사용합니다.
   * 값이 없을 때만 기본 모델을 사용합니다.
   */
  const falModel =
    process.env.FAL_MODEL?.trim() ||
    "fal-ai/flux/dev";

  console.log("FAL 모델:", falModel);
  console.log("FAL 생성 장수:", count);

  const result = await fal.subscribe(falModel, {
    input: {
      prompt: finalPrompt,

      image_size: {
        width: 1080,
        height: 1350
      },

      num_images: count,

      /*
       * flux/dev 계열에서 일반적으로 사용할 수 있는 값입니다.
       * FAL_MODEL을 완전히 다른 모델로 바꾸면 해당 모델의
       * 입력 스키마도 함께 확인해야 합니다.
       */
      num_inference_steps: 28,
      guidance_scale: 3.5,
      enable_safety_checker: true,
      output_format: "jpeg"
    },

    logs: true,

    onQueueUpdate(update) {
      if (update?.status === "IN_PROGRESS") {
        const messages = Array.isArray(update.logs)
          ? update.logs
              .map((log) => log?.message)
              .filter(Boolean)
          : [];

        if (messages.length > 0) {
          console.log(
            "FAL 진행 상태:",
            messages[messages.length - 1]
          );
        }
      }
    }
  });

  const rawImages = result?.data?.images;

  if (!Array.isArray(rawImages)) {
    console.error("FAL 전체 응답:", result);

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
    console.error("FAL 이미지 결과 없음:", result);

    throw new Error(
      "FAL에서 생성된 이미지 URL을 받지 못했습니다."
    );
  }

  return images;
}

/**
 * Replicate 모델 문자열 분석
 *
 * 지원:
 * owner/model
 * owner/model:versionId
 * versionId
 */
function parseReplicateModel(modelValue) {
  const fallback =
    "black-forest-labs/flux-schnell";

  const model = String(
    modelValue || fallback
  ).trim();

  /*
   * 64자리 버전 ID만 입력한 경우
   */
  if (/^[a-f0-9]{64}$/i.test(model)) {
    return {
      type: "version",
      version: model
    };
  }

  /*
   * owner/model:version 형식
   */
  if (model.includes(":")) {
    const separatorIndex = model.indexOf(":");

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

  /*
   * 공식 모델 owner/model 형식
   */
  const [owner, name] = model.split("/");

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
      `${encodeURIComponent(modelInfo.owner)}/` +
      `${encodeURIComponent(modelInfo.name)}/predictions`;

    requestBody = {
      input: {
        prompt: finalPrompt,
        aspect_ratio: "4:5",
        output_format: "jpg",
        output_quality: 90
      }
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      Authorization:
        `Bearer ${process.env.REPLICATE_API_TOKEN}`,

      "Content-Type": "application/json",

      /*
       * Replicate 동기 대기는 최대 60초
       */
      Prefer: "wait=60"
    },

    body: JSON.stringify(requestBody)
  });

  const rawResponse = await response.text();

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
    console.error("Replicate API 오류:", data);

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
 * Replicate가 starting 또는 processing 상태인 경우
 * 완료될 때까지 상태 조회
 */
async function waitForReplicatePrediction(
  prediction
) {
  let current = prediction;

  /*
   * 최대 약 100초 추가 대기
   * 5초 × 20회
   */
  for (
    let attempt = 0;
    attempt < 20;
    attempt += 1
  ) {
    if (current?.status === "succeeded") {
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

    const statusUrl = current?.urls?.get;

    if (!statusUrl) {
      throw new Error(
        "Replicate 결과 조회 주소가 없습니다."
      );
    }

    await sleep(5000);

    const response = await fetch(statusUrl, {
      method: "GET",

      headers: {
        Authorization:
          `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const rawResponse = await response.text();

    let data;

    try {
      data = JSON.parse(rawResponse);
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

  /*
   * 일부 모델에서 객체 형태를 반환할 가능성 처리
   */
  if (output && typeof output === "object") {
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

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "Vercel에 REPLICATE_API_TOKEN이 설정되지 않았습니다."
    );
  }

  const modelInfo = parseReplicateModel(
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

  /*
   * UI에서 2장을 선택하면 2회 요청합니다.
   * 모델별 num_outputs 입력 차이를 피하기 위한 방식입니다.
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
      prediction?.status === "starting" ||
      prediction?.status === "processing"
    ) {
      prediction =
        await waitForReplicatePrediction(
          prediction
        );
    }

    if (prediction?.status === "failed") {
      throw new Error(
        prediction?.error ||
        "Replicate 이미지 생성에 실패했습니다."
      );
    }

    const urls = extractReplicateUrls(
      prediction?.output
    );

    if (urls.length === 0) {
      console.error(
        "Replicate 결과 URL 없음:",
        prediction
      );

      throw new Error(
        `Replicate 이미지 결과가 없습니다. 현재 상태: ${
          prediction?.status || "알 수 없음"
        }`
      );
    }

    urls.forEach((url, outputIndex) => {
      images.push(
        createImageResult(
          "replicate",
          url,
          `${index}-${outputIndex}`
        )
      );
    });
  }

  return images;
}

/**
 * API 메인 핸들러
 */
export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 사용할 수 있습니다."
    });
  }

  const {
    prompt,
    concept = "hook",
    providers = {}
  } = req.body || {};

  const finalSourcePrompt =
    normalizePrompt(prompt);

  if (!finalSourcePrompt) {
    return res.status(400).json({
      error: "이미지 생성 프롬프트가 없습니다."
    });
  }

  const normalizedProviders = {
    fal: normalizeProviderCount(
      providers?.fal
    ),

    replicate: normalizeProviderCount(
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

  /*
   * 요청 가능한 최대 이미지 수 제한
   */
  if (totalSelected > 4) {
    return res.status(400).json({
      error:
        "한 번에 생성할 수 있는 이미지는 최대 4장입니다."
    });
  }

  const finalPrompt = buildFinalPrompt(
    finalSourcePrompt,
    concept
  );

  const tasks = [];
  const images = [];
  const providerErrors = [];

  if (normalizedProviders.fal > 0) {
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

  if (
    normalizedProviders.replicate > 0
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
        providerErrors
      });
    }

    return res.status(200).json({
      success: true,
      images,
      providerErrors,

      /*
       * 디버깅 중에는 유용합니다.
       * 프롬프트를 외부에 보여주고 싶지 않다면
       * 추후 finalPrompt 항목을 삭제할 수 있습니다.
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
