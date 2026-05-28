import type { OnboardingFormValues } from "@/lib/schemas/client";
import type { ClientReference } from "@/types";
import { buildLogoFileName } from "@/lib/utils/logo-filename";

/** System prompt — define a estrutura JSON exata que o modelo deve gerar. */
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
    "layoutAndSpacing": ["rule (PT-BR)", "rule"],
    "typography": ["rule (PT-BR)", "rule"],
    "visualHierarchy": ["rule (PT-BR)", "rule"]
  },
  "nanoBananaPro": {
    "workSurfaces": ["surface name"],
    "sixComponentFormula": "string (PT-BR)",
    "mandatoryConstraints": ["constraint 1", "constraint 2", "constraint 3"],
    "promptTemplates": [
      {
        "name": "template name",
        "workSurface": "surface",
        "aspectRatio": "16:9",
        "prompt": {
          "scene": {
            "subject": "EN: what/who",
            "action": "EN: what is happening",
            "environment": "EN: setting",
            "artStyle": "EN: visual style",
            "lighting": "EN: lighting description",
            "details": "EN: additional visual details"
          },
          "generationInstructions": {
            "layout": {},
            "typography": {},
            "brand": { "logoFileName": "logo.png" },
            "colorPalette": [],
            "constraints": { "must": [], "avoid": [] }
          },
          "visibleCopy": {}
        }
      }
    ]
  }
}

Rules:
- productionRules arrays: minimum 2 items each
- mandatoryConstraints: minimum 3 items
- promptTemplates: 2 to 4 entries
- scene fields in English; all other text in PT-BR
- If reference images provided, add "referenceInsights": [{ "source": "filename", "visualRole": "string", "signals": ["string"] }]
- Output ONLY the JSON — first character must be { and last must be }`;

const PROMPT_SHAPE =
  "{scene:{subject,action,environment,artStyle,lighting,details},generationInstructions:{layout,typography,brand,colorPalette,constraints},visibleCopy:{}}";

/** Onboarding reduzido — sem URLs de storage nem campos vazios. */
export function pickOnboardingForAi(
  onboarding: Partial<OnboardingFormValues>
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const set = (key: string, value: string | string[] | undefined) => {
    if (value === undefined) return;
    if (typeof value === "string" && !value.trim()) return;
    if (Array.isArray(value) && value.length === 0) return;
    out[key] = value;
  };

  set("business", onboarding.businessDescription);
  set("audience", onboarding.targetAudience);
  set("personality", onboarding.brandPersonality);
  set("goals", onboarding.goals);
  set("tone", onboarding.toneOfVoice);
  set("fonts", onboarding.fontStyles);
  if (onboarding.brandColors?.length) set("colors", onboarding.brandColors);
  set("visualInspirations", onboarding.visualInspirations);
  set("avoidStyles", onboarding.avoidStyles);
  set("competitors", onboarding.competitors);

  return out;
}

export function buildCreativeBrainUserPrompt(
  onboarding: Partial<OnboardingFormValues>,
  references: ClientReference[],
  imageLabels: string[],
  clientName?: string,
  skippedImages: string[] = []
): string {
  const logoFileName = clientName
    ? buildLogoFileName(clientName, "png")
    : "logo(cliente).png";

  const refs = [...references]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.file_name);

  const payload: Record<string, unknown> = {
    client: clientName ?? null,
    onboarding: pickOnboardingForAi(onboarding),
    logoFileName,
    refs,
    promptShape: PROMPT_SHAPE,
    templates: { min: 2, max: 4 },
  };

  if (imageLabels.length > 0) {
    payload.images = imageLabels;
  }
  if (skippedImages.length > 0) {
    payload.skipped = skippedImages;
  }

  return JSON.stringify(payload);
}
