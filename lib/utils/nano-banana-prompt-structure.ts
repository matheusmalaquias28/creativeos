import type { PromptJson } from "@/lib/utils/prompt-json";

export type NormalizedNanoBananaPrompt = {
  scene: Record<string, unknown>;
  generationInstructions: Record<string, unknown>;
  visibleCopy: Record<string, unknown>;
};

/** Converte prompt legado (chaves flat) para scene + generationInstructions + visibleCopy */
export function normalizeNanoBananaPromptStructure(
  raw: PromptJson
): NormalizedNanoBananaPrompt {
  if (
    raw.scene &&
    typeof raw.scene === "object" &&
    raw.generationInstructions &&
    typeof raw.generationInstructions === "object"
  ) {
    return {
      scene: raw.scene as Record<string, unknown>,
      generationInstructions: raw.generationInstructions as Record<string, unknown>,
      visibleCopy:
        raw.visibleCopy && typeof raw.visibleCopy === "object"
          ? (raw.visibleCopy as Record<string, unknown>)
          : {},
    };
  }

  const {
    subject,
    action,
    environment,
    artStyle,
    lighting,
    details,
    layout,
    typography,
    brand,
    constraints,
    meta,
    visibleCopy,
    legacyFormat,
    promptText,
    ...rest
  } = raw;

  if (legacyFormat === "text" && typeof promptText === "string") {
    return {
      scene: {
        subject: "Brand visual",
        action: "Commercial static composition",
        environment: "Social ad frame",
        artStyle: "On-brand photography or design",
        lighting: "Balanced commercial lighting",
        details: promptText.slice(0, 500),
      },
      generationInstructions: {},
      visibleCopy: {},
    };
  }

  return {
    scene: {
      subject: subject ?? "Main subject",
      action: action ?? "Static brand composition",
      environment: environment ?? "Ad canvas",
      artStyle: artStyle ?? "Commercial branded",
      lighting: lighting ?? "Soft key light",
      details: details ?? "Sharp focus, clean background",
    },
    generationInstructions: {
      ...(meta && typeof meta === "object" ? { meta } : {}),
      ...(layout !== undefined ? { layout } : {}),
      ...(typography !== undefined ? { typography } : {}),
      ...(brand !== undefined ? { brand } : {}),
      ...(constraints !== undefined ? { constraints } : {}),
      ...rest,
    },
    visibleCopy:
      visibleCopy && typeof visibleCopy === "object"
        ? (visibleCopy as Record<string, unknown>)
        : {},
  };
}

/** Payload para Nano Banana: cena + cópia visível; regras em applySilently (nunca como texto na arte) */
export function buildNanoBananaRuntimePayload(
  normalized: NormalizedNanoBananaPrompt,
  meta?: { workSurface?: string; aspectRatio?: string; templateName?: string }
): Record<string, unknown> {
  return {
    _critical:
      "NEVER render generationInstructions, meta, hex codes, spacing rules, font names, or JSON keys as visible typography in the image. Only render strings inside visibleCopy.",
    meta,
    render: {
      scene: normalized.scene,
      visibleCopy: normalized.visibleCopy,
    },
    applySilently: normalized.generationInstructions,
  };
}
