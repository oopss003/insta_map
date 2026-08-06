/** api/generate-images.js */
export const maxDuration = 300;

import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const CONCEPTS = {
  hook: "High-impact editorial advertising photography with immediate thumbnail clarity and one unmistakable subject.",
  insight: "Credible documentary photography, analytical and professional, natural navy, ivory and warm orange accents.",
  magazine: "Premium contemporary magazine photography, refined cinematic realism, natural texture and subtle visual tension."
};

const PHOTO_TEMPLATES = ["photo-hook", "editorial-photo", "photo-data-hybrid"];
const GENERATION_MODES = ["hero-photo", "support-image", "background-image"];

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(2, Math.floor(number))) : 0;
}

function clean(value, max = 10000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function imageResult(provider, url, index) {
  return { id: `${provider}-${Date.now()}-${index}`, provider, imageUrl: url };
}

function normalizeGenerationMode(value, templateType) {
  if (GENERATION_MODES.includes(value)) return value;
  return PHOTO_TEMPLATES.includes(templateType) ? "hero-photo" : "support-image";
}

function canGenerateImage({ photoRequirement, templateType, generationMode }) {
  if (generationMode === "support-image" || generationMode === "background-image") return true;
  if (photoRequirement === "none") return false;
  return PHOTO_TEMPLATES.includes(templateType) || photoRequirement === "required";
}

function compositionInstruction(composition = {}, designMode = "photo-heavy", generationMode = "hero-photo") {
  const area = composition.reservedTextArea || "lower-left";
  const subject = composition.subjectPosition || "right-center";
  const shot = composition.cameraShot || "medium-wide";
  const density = composition.backgroundDensity || "low";
  const densityRule = density === "low"
    ? "Use a clean, simple background with very few competing objects."
    : "Use a realistic moderately detailed environment, but keep the reserved text area visually quiet.";

  if (generationMode === "support-image") {
    return `Create a compact supporting image for a designed information slide. Camera: ${shot}. Place one clear subject at ${subject}. Keep the image visually simple, easy to crop, and understandable at thumbnail size. Avoid important details near the edges. The image will be inserted as a top banner, side thumbnail, or card-top image, so do not rely on full-frame storytelling.`;
  }
  if (generationMode === "background-image") {
    return `Create a restrained background photograph that can sit behind text at low opacity. Camera: ${shot}. Use soft depth, low contrast, and broad quiet areas. Keep the ${area} region especially calm. Avoid strong facial close-ups, hard highlights, or dense details that would compete with typography.`;
  }

  const modeRule = designMode === "hybrid"
    ? "Compose the subject on roughly one half of the frame and leave a clean structured zone for one or two data points added later."
    : "Let the real-world scene and action dominate while preserving a generous negative-space text zone.";
  return `Camera: ${shot}. Place the primary subject at ${subject}. Keep the ${area} region calm and low-detail for Korean text added later. ${densityRule} ${modeRule} Keep faces, hands, products and key actions outside the text zone.`;
}

function roleInstruction(role = "insight") {
  const map = {
    hook: "Create one instantly understandable moment with visual tension or a surprising real-life situation.",
    evidence: "Show an observable real-world behavior or measurement context, not an abstract claim.",
    comparison: "Show a single coherent scene that makes the contrast understandable without a split-screen or collage.",
    case: "Show a specific believable situation with concrete place, action and limited people.",
    solution: "Show the changed behavior or improved operating situation in action, not a generic success pose.",
    action: "Show the exact practical action the audience should take.",
    cta: "Use a restrained, premium closing scene with ample negative space."
  };
  return map[role] || "Show a specific real-world action that directly explains the slide message.";
}

function profileInstruction(profile = {}) {
  const persona = clean(profile.speakerPersona, 200);
  const audience = clean(profile.targetAudience, 250);
  if (!persona && !audience) return "";
  return `Audience context: ${audience || "the intended audience"}. Tone cue: ${persona || "credible and natural"}. Reflect this through setting, casting and behavior only when it helps the message; do not automatically depict the speaker's profession.`;
}

function placementInstruction(placement = "top-banner") {
  const map = {
    "top-banner": "Favor a wide, shallow composition with the main subject centered or slightly offset.",
    "side-thumbnail": "Favor a compact vertical crop with one clear subject and minimal background.",
    "card-top": "Favor a simple horizontal crop suitable for the top portion of a card.",
    "full-background": "Favor broad atmospheric depth and low-detail negative space."
  };
  return map[placement] || map["top-banner"];
}

function buildPrompt({ prompt, concept, imageComposition, role, designMode, contentProfile, generationMode, supportImagePlacement }) {
  const scene = clean(prompt);
  const style = CONCEPTS[concept] || CONCEPTS.hook;
  const modeSpecific = generationMode === "support-image"
    ? `This is a supporting visual, not the whole slide. ${placementInstruction(supportImagePlacement)}`
    : generationMode === "background-image"
      ? "This image will be used behind text with reduced opacity. Keep contrast restrained and visual noise low."
      : "This is the primary full-slide photograph.";

  return `${scene}\n\n${style}\n${roleInstruction(role)}\n${compositionInstruction(imageComposition, designMode, generationMode)}\n${profileInstruction(contentProfile)}\n${modeSpecific}\n\nHard requirements:\n- vertical 4:5 Instagram source image unless the placement instruction asks for a crop-friendly supporting image\n- photorealistic editorial or documentary photograph\n- a specific place, concrete action, clear number of people, camera angle and advertising/content context\n- one coherent scene; no collage, split screen, infographic, chart, poster or UI overlay\n- no generic office, boardroom, laptop-viewing person, handshake, empty business pose or meaningless stock-photo scene unless explicitly essential\n- realistic faces, hands, anatomy, products, architecture and lighting\n- Every storefront sign, signboard, menu board, banner, poster, window notice, price board, paper notice, digital display and illuminated panel must be completely blank and plain colored, turned away from the camera, cropped out, heavily defocused, or covered by natural glare.\n- Do not generate letters, characters, glyphs, symbols, numbers, pseudo-writing, Chinese-like, Korean-like, Japanese-like or English-like text, logos, logo-like marks, watermarks or brand marks.\n- Express commercial-street atmosphere through lighting, awnings, entrances, display windows, architecture, pedestrian behavior and spatial depth instead of written signage.\n- Keep the camera below sign height when commercial facades are present, crop upper signage, avoid straight-on signboards, and keep readable surfaces out of focus.\n- preserve the requested location, action, camera angle, subject position and negative space`.trim();
}

async function generateFal(prompt, n) {
  if (!n) return [];
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY가 없습니다.");
  const model = process.env.FAL_MODEL?.trim() || "fal-ai/flux/dev";
  const input = {
    prompt,
    image_size: { width: 1080, height: 1350 },
    num_images: n,
    num_inference_steps: 32,
    guidance_scale: 3.8,
    enable_safety_checker: true,
    output_format: "png"
  };
  const negativeModels = (process.env.FAL_NEGATIVE_PROMPT_MODELS || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  if (negativeModels.includes(model)) {
    input.negative_prompt = "text, letters, characters, glyphs, symbols, numbers, pseudo-writing, Chinese-like text, Korean-like text, Japanese-like text, English-like text, logos, brand marks, watermarks, readable signs, malformed hands, malformed faces";
  }
  const result = await fal.subscribe(model, { input, logs: true });
  const raw = result?.data?.images;
  if (!Array.isArray(raw)) throw new Error("FAL 응답에 images 배열이 없습니다.");
  return raw.map((item, index) => imageResult("fal", typeof item === "string" ? item : item?.url, index))
    .filter(item => /^https?:\/\//.test(item.imageUrl || ""));
}

function parseReplicateModel(value) {
  const model = clean(value || "black-forest-labs/flux-schnell", 300);
  if (/^[a-f0-9]{64}$/i.test(model)) return { type: "version", version: model };
  const [path, version] = model.split(":");
  if (version && /^[a-f0-9]{64}$/i.test(version)) return { type: "version", version };
  const [owner, name] = path.split("/");
  return { type: "official", owner: owner || "black-forest-labs", name: name || "flux-schnell" };
}

async function createPrediction(info, prompt) {
  const endpoint = info.type === "version"
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.name)}/predictions`;
  const body = info.type === "version"
    ? { version: info.version, input: { prompt, aspect_ratio: "4:5", output_format: "png" } }
    : { input: { prompt, aspect_ratio: "4:5", output_format: "png" } };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60"
    },
    body: JSON.stringify(body)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("Replicate 응답을 읽지 못했습니다."); }
  if (!response.ok) throw new Error(data?.detail || data?.error || `Replicate 오류 HTTP ${response.status}`);
  return data;
}

async function waitPrediction(prediction) {
  let current = prediction;
  for (let index = 0; index < 20; index += 1) {
    if (current?.status === "succeeded") return current;
    if (["failed", "canceled"].includes(current?.status)) throw new Error(current?.error || `Replicate ${current.status}`);
    if (!current?.urls?.get) break;
    await sleep(5000);
    const response = await fetch(current.urls.get, { headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` } });
    current = await response.json();
  }
  throw new Error("Replicate 생성 대기 시간이 초과됐습니다.");
}

function urls(output) {
  if (typeof output === "string") return [output];
  if (Array.isArray(output)) return output.filter(item => typeof item === "string");
  if (output && typeof output === "object") return [output.url, output.image, output.imageUrl, output.output].filter(item => typeof item === "string");
  return [];
}

async function generateReplicate(prompt, n) {
  if (!n) return [];
  if (!process.env.REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN이 없습니다.");
  const info = parseReplicateModel(process.env.REPLICATE_MODEL);
  const output = [];
  for (let index = 0; index < n; index += 1) {
    let prediction = await createPrediction(info, prompt);
    if (["starting", "processing"].includes(prediction?.status)) prediction = await waitPrediction(prediction);
    urls(prediction?.output).filter(url => /^https?:\/\//.test(url)).forEach((url, childIndex) => {
      output.push(imageResult("replicate", url, `${index}-${childIndex}`));
    });
  }
  return output;
}

function extractGeminiImages(data) {
  const output = [];
  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || "image/png";
        output.push(`data:${mime};base64,${inline.data}`);
      }
    }
  }
  return output;
}

async function generateGemini(prompt, n) {
  if (!n) return [];
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY가 없습니다.");
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
  const output = [];
  for (let index = 0; index < n; index += 1) {
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["Image"], imageConfig: { aspectRatio: "4:5", imageSize: "1K" } }
      })
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Gemini 응답을 읽지 못했습니다."); }
    if (!response.ok) throw new Error(data?.error?.message || `Gemini 오류 HTTP ${response.status}`);
    const found = extractGeminiImages(data);
    if (!found.length) throw new Error("Gemini 응답에 이미지가 없습니다.");
    found.forEach((url, childIndex) => output.push(imageResult("gemini", url, `${index}-${childIndex}`)));
  }
  return output;
}

function inspectCandidate(image) {
  return {
    id: image.id,
    status: "unchecked",
    issues: [],
    retryRecommended: false,
    note: "문자·로고 자동 검사는 별도 비전 검사 API를 연결할 수 있도록 결과 구조만 준비되어 있습니다."
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 지원합니다." });

  const {
    prompt,
    concept = "hook",
    providers = {},
    imageComposition = {},
    role = "insight",
    photoRequirement = "required",
    templateType = "photo-hook",
    designMode = "photo-heavy",
    contentProfile = {},
    generationMode: requestedGenerationMode,
    supportImagePlacement = "top-banner"
  } = req.body || {};

  const generationMode = normalizeGenerationMode(requestedGenerationMode, templateType);
  if (!canGenerateImage({ photoRequirement, templateType, generationMode })) {
    return res.status(400).json({ error: "이 장표는 현재 이미지 생성 대상이 아닙니다." });
  }

  const source = clean(prompt);
  if (!source) return res.status(400).json({ error: "이미지 프롬프트가 없습니다." });

  const normalized = {
    fal: count(providers.fal),
    replicate: count(providers.replicate),
    gemini: count(providers.gemini)
  };
  if (normalized.fal + normalized.replicate + normalized.gemini < 1) {
    return res.status(400).json({ error: "이미지를 1장 이상 선택하세요." });
  }

  const finalPrompt = buildPrompt({
    prompt: source,
    concept,
    imageComposition,
    role,
    designMode,
    contentProfile,
    generationMode,
    supportImagePlacement
  });

  const images = [];
  const providerErrors = [];
  const jobs = [];
  if (normalized.fal) jobs.push(generateFal(finalPrompt, normalized.fal).then(result => images.push(...result)).catch(error => providerErrors.push({ provider: "fal", message: error.message })));
  if (normalized.replicate) jobs.push(generateReplicate(finalPrompt, normalized.replicate).then(result => images.push(...result)).catch(error => providerErrors.push({ provider: "replicate", message: error.message })));
  if (normalized.gemini) jobs.push(generateGemini(finalPrompt, normalized.gemini).then(result => images.push(...result)).catch(error => providerErrors.push({ provider: "gemini", message: error.message })));
  await Promise.all(jobs);

  if (!images.length) return res.status(500).json({ error: "생성된 이미지가 없습니다.", providerErrors });

  return res.status(200).json({
    success: true,
    images,
    providerErrors,
    finalPrompt,
    generationMode,
    candidateChecks: images.map(inspectCandidate)
  });
}
