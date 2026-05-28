import type { BrandDna, NanoBananaPromptTemplate } from "@/types";
import {
  buildNanoBananaRuntimePayload,
  normalizeNanoBananaPromptStructure,
} from "@/lib/utils/nano-banana-prompt-structure";
import { formatPromptJson, normalizeTemplatePrompt } from "@/lib/utils/prompt-json";

/**
 * Payload JSON para Nano Banana Pro — apenas render + applySilently.
 * Instruções técnicas não devem virar texto na arte.
 */
export function buildNanoBananaPromptFromTemplate(
  template: NanoBananaPromptTemplate,
  brandDna: BrandDna,
  overrides?: {
    headline?: string;
    cta?: string;
    extraDetails?: string;
    aspectRatio?: string;
  }
): string {
  const base = normalizeTemplatePrompt(template);
  const normalized = normalizeNanoBananaPromptStructure(base);

  if (overrides?.headline) {
    normalized.visibleCopy.headline = overrides.headline;
  }
  if (overrides?.cta) {
    normalized.visibleCopy.cta = overrides.cta;
  }
  if (overrides?.extraDetails) {
    normalized.scene.details = `${String(normalized.scene.details ?? "")} ${overrides.extraDetails}`.trim();
  }

  normalized.generationInstructions = {
    ...normalized.generationInstructions,
    // Brand identity
    brandStyle: brandDna.brandStyle,
    visualDirection: brandDna.visualDirection,
    visualKeywords: brandDna.visualKeywords,
    compositionPreferences: brandDna.compositionPreferences,
    recommendedHooks: brandDna.recommendedHooks,
    // Nano Banana Pro formula — defines the structural creative formula
    sixComponentFormula: brandDna.nanoBananaPro?.sixComponentFormula,
    // Colors
    colorPalette:
      (normalized.generationInstructions.colorPalette as string[] | undefined) ??
      brandDna.preferredColors,
    // Constraints (must / avoid)
    constraints: {
      ...(typeof normalized.generationInstructions.constraints === "object" &&
      normalized.generationInstructions.constraints !== null
        ? (normalized.generationInstructions.constraints as Record<string, unknown>)
        : {}),
      must: [
        ...(brandDna.nanoBananaPro?.mandatoryConstraints ?? []),
        ...(brandDna.productionRules?.layoutAndSpacing ?? []),
        ...(brandDna.productionRules?.typography ?? []),
        ...(brandDna.productionRules?.visualHierarchy ?? []),
      ],
      avoid: [...(brandDna.negativeStyles ?? [])],
    },
  };

  const payload = buildNanoBananaRuntimePayload(normalized, {
    workSurface: template.workSurface,
    aspectRatio: overrides?.aspectRatio ?? template.aspectRatio,
    templateName: template.name,
  });

  return formatPromptJson(payload);
}

export function getDefaultNanoBananaTemplate(
  brandDna: BrandDna
): NanoBananaPromptTemplate | null {
  const templates = brandDna.nanoBananaPro?.promptTemplates;
  if (!templates?.length) return null;
  return templates[0];
}
