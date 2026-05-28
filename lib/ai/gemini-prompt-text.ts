import {
  ART_PRODUCTION_MANDATORY_RULES,
  NANO_BANANA_PROMPT_RULES,
} from "@/lib/ai/prompts/nano-banana-pro";

const QUALITY_PROMPTS: Record<string, string> = {
  "1k": "Standard quality.",
  "2k": "High definition, sharp and crisp, full HD quality.",
  "4k": "Ultra HD 4K, maximum resolution, extremely detailed, photorealistic rendering.",
};

const QUALITY_SHORT: Record<string, string> = {
  "1k": "standard quality",
  "2k": "high definition, sharp",
  "4k": "ultra HD 4K, extremely detailed, photorealistic",
};

/**
 * Prompt conciso para a API Nano Banana Pro (limite: 5000 chars).
 * Extraído dos campos render + applySilently do payload Brand DNA.
 */
export function buildNanoBananaProCompactPrompt(
  payload: Record<string, unknown>,
  quality?: string
): string {
  const render = payload.render as Record<string, unknown> | undefined;
  const applySilently = payload.applySilently as Record<string, unknown> | undefined;
  const meta = payload.meta as Record<string, unknown> | undefined;

  const scene = render?.scene as Record<string, unknown> | undefined;
  const visibleCopy = render?.visibleCopy as Record<string, unknown> | undefined;

  const brandStyle = applySilently?.brandStyle;
  const visualDirection = applySilently?.visualDirection;
  const colorPalette = applySilently?.colorPalette;
  const constraints = applySilently?.constraints as Record<string, unknown> | undefined;
  const avoid = constraints?.avoid;

  const parts: string[] = [];

  const qualityStr = quality ? (QUALITY_SHORT[quality] ?? "") : "";
  parts.push(`Professional marketing creative image.${qualityStr ? " " + qualityStr + "." : ""}`);

  if (scene) {
    const sceneValues = Object.values(scene)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join(". ");
    if (sceneValues) parts.push(`Scene: ${sceneValues}.`);
  }

  if (visibleCopy) {
    const copyParts = Object.entries(visibleCopy)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
      .map(([k, v]) => `${k}: "${v}"`);
    if (copyParts.length) parts.push(`Visible text only: ${copyParts.join(", ")}.`);
    else parts.push("No text or typography in the image.");
  }

  if (brandStyle) parts.push(`Brand style: ${brandStyle}.`);
  if (visualDirection) parts.push(`Visual direction: ${visualDirection}.`);

  if (Array.isArray(colorPalette) && colorPalette.length) {
    parts.push(`Color palette: ${colorPalette.slice(0, 6).join(", ")}.`);
  }

  if (meta?.workSurface) parts.push(`Format: ${meta.workSurface}.`);

  if (Array.isArray(avoid) && avoid.length) {
    parts.push(`Avoid: ${avoid.slice(0, 8).join(", ")}.`);
  }

  return parts.join(" ").slice(0, 4990);
}

/**
 * Converte o payload runtime do Brand DNA em instrução textual para a API Gemini Image.
 * Aplica integralmente as regras Nano Banana Pro.
 */
export function buildGeminiImagePromptText(
  payload: Record<string, unknown>,
  quality?: string
): string {
  const render = payload.render as Record<string, unknown> | undefined;
  const applySilently = payload.applySilently as Record<string, unknown> | undefined;
  const meta = payload.meta as Record<string, unknown> | undefined;

  const scene = render?.scene ?? {};
  const visibleCopy = render?.visibleCopy ?? {};
  const hasVisibleCopy =
    visibleCopy &&
    typeof visibleCopy === "object" &&
    Object.values(visibleCopy).some((v) => typeof v === "string" && v.trim().length > 0);

  const qualityLine = quality ? (QUALITY_PROMPTS[quality] ?? "") : "";

  return [
    `Generate a single professional marketing creative image using the Nano Banana Pro methodology.${qualityLine ? " " + qualityLine : ""}`,
    "",
    "=== NANO BANANA PRO — CRITICAL RULES (violations fail the task) ===",
    ...NANO_BANANA_PROMPT_RULES.map((r) => `- ${r}`),
    "",
    "=== ART PRODUCTION MANDATORY RULES (apply silently — never render as text) ===",
    ...ART_PRODUCTION_MANDATORY_RULES.map((r) => `- ${r}`),
    "",
    "=== WORK SURFACE / FORMAT ===",
    JSON.stringify(meta ?? {}, null, 2),
    "",
    "=== VISIBLE COPY (ONLY these strings may appear as typography in the image) ===",
    hasVisibleCopy
      ? JSON.stringify(visibleCopy, null, 2)
      : "NONE — do not add any text or copy to the artwork.",
    "",
    "=== VISUAL SCENE (pictorial description — what the camera sees) ===",
    JSON.stringify(scene, null, 2),
    "",
    "=== BRAND DNA — APPLY SILENTLY (never render as visible text) ===",
    JSON.stringify(applySilently ?? {}, null, 2),
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
