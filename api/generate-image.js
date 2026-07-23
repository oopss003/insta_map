import { fal } from "@fal-ai/client";

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
High-impact social media advertising photography.
Strong visual contrast, dramatic lighting, bold composition,
clear main subject, visually surprising scene,
attention-grabbing Instagram thumbnail style.
Leave clean dark space in the lower third for a large Korean headline.
`,

    insight: `
Professional editorial advertising photography.
Sophisticated navy, ivory and warm orange atmosphere,
clean corporate composition, credible marketing insight mood,
modern advertising industry visual,
balanced negative space for Korean headline placement.
`,

    magazine: `
Premium contemporary magazine editorial photography.
Stylish composition, modern visual direction,
natural cinematic lighting, refined textures,
trendy advertising and lifestyle magazine mood,
generous negative space for headline typography.
`
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "POST 요청만 사용할 수 있습니다."
        });
    }

    if (!process.env.FAL_KEY) {
        return res.status(500).json({
            error: "Vercel에 FAL_KEY가 설정되지 않았습니다."
        });
    }

    const {
        prompt,
        concept = "hook"
    } = req.body || {};

    if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
    ) {
        return res.status(400).json({
            error: "이미지 생성 프롬프트가 없습니다."
        });
    }

    const normalizedConcept =
        VALID_CONCEPTS.includes(concept)
            ? concept
            : "hook";

    const finalPrompt = `
${prompt.trim()}

${CONCEPT_PROMPTS[normalizedConcept]}

Required output:
- vertical 4:5 Instagram feed composition
- photorealistic professional advertising image
- one clear main visual subject
- visually strong at thumbnail size
- clean space for Korean headline
- no text
- no Korean letters
- no English letters
- no typography
- no captions
- no logo
- no watermark
- no UI elements
- no borders
`;

    try {
        const result = await fal.subscribe(
            "fal-ai/flux/dev",
            {
                input: {
                    prompt: finalPrompt,

                    image_size: {
                        width: 1080,
                        height: 1350
                    },

                    num_inference_steps: 28,
                    guidance_scale: 3.5,
                    num_images: 1,
                    enable_safety_checker: true,
                    output_format: "jpeg",
                    acceleration: "none"
                },

                logs: true,

                onQueueUpdate: (update) => {
                    if (
                        update.status ===
                        "IN_PROGRESS"
                    ) {
                        const logs =
                            Array.isArray(update.logs)
                                ? update.logs
                                : [];

                        logs.forEach((log) => {
                            if (log?.message) {
                                console.log(
                                    "[FAL]",
                                    log.message
                                );
                            }
                        });
                    }
                }
            }
        );

        const image =
            result?.data?.images?.[0];

        if (!image?.url) {
            console.error(
                "FAL result:",
                JSON.stringify(result)
            );

            return res.status(500).json({
                error:
                    "이미지가 생성됐지만 이미지 주소를 받지 못했습니다."
            });
        }

        return res.status(200).json({
            success: true,
            imageUrl: image.url,
            contentType:
                image.content_type ||
                "image/jpeg",
            seed:
                result?.data?.seed ?? null,
            prompt:
                result?.data?.prompt ||
                finalPrompt,
            requestId:
                result?.requestId || null,
            concept:
                normalizedConcept
        });
    } catch (error) {
        console.error(
            "FAL image generation error:",
            error
        );

        const errorMessage =
            error?.body?.detail ||
            error?.message ||
            "이미지 생성 중 오류가 발생했습니다.";

        return res.status(500).json({
            error: errorMessage
        });
    }
}
