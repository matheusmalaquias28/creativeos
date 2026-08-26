import type { OnboardingFormValues } from "@/lib/schemas/client";
import type { VisualIdentityDna } from "@/lib/schemas/visual-identity";
import type { ClientReference } from "@/types";
import { buildLogoFileName } from "@/lib/utils/logo-filename";

export const CREATIVE_BRAIN_SYSTEM_PROMPT = `You are a brand strategist AI. Output ONLY a raw JSON object — no markdown fences, no explanation, no extra text.

The JSON MUST use exactly these field names and types:
{
  "brandStyle": "string (PT-BR)",
  "visualDirection": "string (PT-BR)",
  "audienceProfile": "string (PT-BR)",
  "preferredColors": ["#hex or color name"],
  "compositionPreferences": ["string (PT-BR)"],
  "negativeStyles": ["string (PT-BR)"],
  "recommendedHooks": ["string (PT-BR)"],
  "visualKeywords": ["string (PT-BR)"],
  "productionRules": {
    "layoutAndSpacing": ["rule (PT-BR)"],
    "typography": ["rule (PT-BR)"],
    "visualHierarchy": ["rule (PT-BR)"]
  }
}

Rules:
- productionRules arrays: minimum 2 items each
- preferredColors: include hex codes when known
- negativeStyles: concrete visual styles to avoid
- visualKeywords: adjectives/references that capture the brand aesthetic
- If reference images provided, add "referenceInsights": [{ "source": "filename", "visualRole": "string", "signals": ["string"] }]
- Output ONLY the JSON — first character must be { and last must be }`;

export function pickOnboardingForAi(
  onboarding: Partial<OnboardingFormValues>,
  visualIdentity?: VisualIdentityDna | null
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const set = (key: string, value: string | string[] | undefined) => {
    if (value === undefined) return;
    if (typeof value === "string" && !value.trim()) return;
    if (Array.isArray(value) && value.length === 0) return;
    out[key] = value;
  };

  if (visualIdentity) {
    set("visualIdentitySummary", visualIdentity.summary);
    set("colors", visualIdentity.palette);
    set("typography", [
      visualIdentity.typography.headlineStyle,
      visualIdentity.typography.bodyStyle,
      visualIdentity.typography.notes ?? "",
    ].filter(Boolean));
    set("compositionStyle", visualIdentity.compositionStyle);
    set("visualKeywords", visualIdentity.visualKeywords);
    set("mood", visualIdentity.mood);
  }

  if (onboarding.logoUrl) set("logoUrl", onboarding.logoUrl);

  return out;
}

export function buildCreativeBrainUserPrompt(
  onboarding: Partial<OnboardingFormValues>,
  references: ClientReference[],
  imageLabels: string[],
  clientName?: string,
  skippedImages: string[] = [],
  visualIdentity?: VisualIdentityDna | null
): string {
  const logoFileName = clientName
    ? buildLogoFileName(clientName, "png")
    : "logo(cliente).png";

  const refs = [...references]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.file_name);

  const payload: Record<string, unknown> = {
    client: clientName ?? null,
    onboarding: pickOnboardingForAi(onboarding, visualIdentity),
    logoFileName,
    refs,
  };

  if (imageLabels.length > 0) payload.images = imageLabels;
  if (skippedImages.length > 0) payload.skipped = skippedImages;

  return JSON.stringify(payload);
}
