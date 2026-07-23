import { fal } from "@fal-ai/client";

fal.config({
    credentials: process.env.FAL_KEY
});

const VALID_CONCEPTS = ["hook", "insight", "magazine"];

const CONCEPT_PROMPTS = {
    hook: `
High-impact social media advertising photography.
Strong contrast, dramatic lighting, attention-grabbing composition.
Make the scene visually striking at thumbnail size.
Leave clean space for a Korean headline.
`,
    insight: `
Professional editorial advertising photography.
Sophisticated navy, ivory and warm orange atmosphere.
Corporate and credible marketing insight mood.
Leave balanced negative space for a Korean headline.
`,
    magazine: `
Premium modern magazine editorial photography.
Stylish, refined, cinematic and trendy visual direction.
Leave generous clean space for headline typography.
`
};

function normalizeProviderCount(value) {
    const num = Number(value) || 0;
    return Math.max(0, Math.min(num, 2));
}

function buildFinalPrompt(prompt, concept) {
    const normalizedConcept = VALID_CONCEPTS.includes(concept)
        ? concept
        : "hook";

    return `
${prompt.trim()}

${CONCEPT_PROMPTS[normalizedConcept]}

Required output:
- vertical 4:5 Instagram composition
- photorealistic high-quality advertising image
- one strong clear main visual subject
- visually compelling and clickable
- clean space for Korean headline
- no text
- no letters
- no typography
- no captions
- no logo
- no watermark
- no borders
`;
}

async function generateFalImages(finalPrompt, count) {
    if (!process.env.FAL_KEY) {
        throw new Error("FAL_KEY가 설정되지 않았습니다.");
    }

    const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
            prompt: finalPrompt,
            image_size: {
                width: 1080,
                height: 1350
            },
            num_inference_steps: 28,
            guidance_scale: 3.5,
            num_images: count,
            enable_safety_checker: true,
            output_format: "jpeg",
            acceleration: "none"
        },
        logs: true
    });

    const images = Array.isArray(result?.data?.images)
        ? result.data.images
              .filter((item) => item?.url)
              .map((item, index) => ({
                  id: `fal-${Date.now()}-${index}`,
                  provider: "fal",
                  imageUrl: item.url
              }))
        : [];

    return images;
}

function parseReplicateModel(modelString) {
    const fallback = "black-forest-labs/flux-schnell";
    const model = (modelString || fallback).trim();

    const [owner, name] = model.split("/");

    if (!owner || !name) {
        return {
            owner: "black-forest-labs",
            name: "flux-schnell"
        };
    }

    return { owner, name };
}

async function generateReplicateImages(finalPrompt, count) {
    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error("REPLICATE_API_TOKEN이 설정되지 않았습니다.");
    }

    const { owner, name } = parseReplicateModel(process.env.REPLICATE_MODEL);

    const results = [];

    for (let i = 0; i < count; i += 1) {
        const response = await fetch(
            `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
                    "Content-Type": "application/json",
                    Prefer: "wait=90"
                },
                body: JSON.stringify({
                    input: {
                        prompt: finalPrompt,
                        aspect_ratio: "4:5",
                        output_format: "jpg",
                        output_quality: 90
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data?.detail ||
                    data?.error ||
                    "Replicate 이미지 생성 요청에 실패했습니다."
            );
        }

        const output = data?.output;

        if (Array.isArray(output)) {
            output.forEach((url, index) => {
                if (typeof url === "string" && url) {
                    results.push({
                        id: `replicate-${Date.now()}-${i}-${index}`,
                        provider: "replicate",
                        imageUrl: url
                    });
                }
            });
        } else if (typeof output === "string" && output) {
            results.push({
                id: `replicate-${Date.now()}-${i}`,
                provider: "replicate",
                imageUrl: output
            });
        }
    }

    return results;
}

async function generateCivitaiImages(finalPrompt, count) {
    if (!process.env.CIVITAI_API_TOKEN) {
        throw new Error("CIVITAI_API_TOKEN이 설정되지 않았습니다.");
    }

    if (!process.env.CIVITAI_MODEL_VERSION_ID) {
        throw new Error(
            "Civitai는 토큰 외에 CIVITAI_MODEL_VERSION_ID가 추가로 필요합니다."
        );
    }

    throw new Error(
        "Civitai 생성 코드는 모델 버전 ID까지 준비되면 연결할 수 있도록 구조만 넣어두었습니다."
    );
}

export default async function handler(req, res) {
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

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({
            error: "이미지 생성 프롬프트가 없습니다."
        });
    }

    const normalizedProviders = {
        fal: normalizeProviderCount(providers.fal),
        replicate: normalizeProviderCount(providers.replicate),
        civitai: normalizeProviderCount(providers.civitai)
    };

    const totalSelected =
        normalizedProviders.fal +
        normalizedProviders.replicate +
        normalizedProviders.civitai;

    if (totalSelected <= 0) {
        return res.status(400).json({
            error: "최소 1장 이상 선택해 주세요."
        });
    }

    const finalPrompt = buildFinalPrompt(prompt, concept);

    const tasks = [];
    const providerErrors = [];
    const images = [];

    if (normalizedProviders.fal > 0) {
        tasks.push(
            generateFalImages(finalPrompt, normalizedProviders.fal)
                .then((result) => {
                    images.push(...result);
                })
                .catch((error) => {
                    providerErrors.push({
                        provider: "fal",
                        message: error.message || "FAL 오류"
                    });
                })
        );
    }

    if (normalizedProviders.replicate > 0) {
        tasks.push(
            generateReplicateImages(finalPrompt, normalizedProviders.replicate)
                .then((result) => {
                    images.push(...result);
                })
                .catch((error) => {
                    providerErrors.push({
                        provider: "replicate",
                        message: error.message || "Replicate 오류"
                    });
                })
        );
    }

    if (normalizedProviders.civitai > 0) {
        tasks.push(
            generateCivitaiImages(finalPrompt, normalizedProviders.civitai)
                .then((result) => {
                    images.push(...result);
                })
                .catch((error) => {
                    providerErrors.push({
                        provider: "civitai",
                        message: error.message || "Civitai 오류"
                    });
                })
        );
    }

    try {
        await Promise.all(tasks);

        if (images.length === 0) {
            return res.status(500).json({
                error: "생성된 이미지가 없습니다.",
                providerErrors
            });
        }

        return res.status(200).json({
            success: true,
            images,
            providerErrors,
            finalPrompt
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "이미지 생성 중 오류가 발생했습니다."
        });
    }
}
