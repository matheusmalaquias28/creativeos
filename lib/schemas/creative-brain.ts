import { z } from "zod";
import { normalizeNanoBananaPromptStructure } from "@/lib/utils/nano-banana-prompt-structure";

export const productionRulesSchema = z.object({
  layoutAndSpacing: z
    .array(z.string())
    .min(2, "Regras de layout/espaçamento insuficientes"),
  typography: z.array(z.string()).min(2, "Regras tipográficas insuficientes"),
  visualHierarchy: z.array(z.string()).min(2),
});

export const referenceInsightSchema = z.object({
  source: z.string(),
  visualRole: z.string(),
  signals: z.array(z.string()).min(1),
});

const sceneSchema = z.object({
  subject: z.string().min(1),
  action: z.string().min(1),
  environment: z.string().min(1),
  artStyle: z.string().min(1),
  lighting: z.string().min(1),
  details: z.string().min(1),
});

const generationInstructionsSchema = z
  .object({
    layout: z.record(z.string(), z.unknown()).optional(),
    typography: z.record(z.string(), z.unknown()).optional(),
    brand: z.record(z.string(), z.unknown()).optional(),
    colorPalette: z.array(z.string()).optional(),
    constraints: z
      .object({
        must: z.array(z.string()).optional(),
        avoid: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .catchall(z.unknown());

const visibleCopySchema = z
  .object({
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    cta: z.string().optional(),
  })
  .default({});

export const nanoBananaPromptJsonSchema = z
  .object({
    scene: sceneSchema,
    generationInstructions: generationInstructionsSchema,
    visibleCopy: visibleCopySchema,
  })
  .strict();

export const nanoBananaPromptTemplateSchema = z
  .object({
    name: z.string(),
    workSurface: z.string(),
    aspectRatio: z.string(),
    prompt: z.record(z.string(), z.unknown()),
    fullPrompt: z.string().min(1).optional(),
  })
  .transform((template) => {
    let raw: Record<string, unknown>;

    if (template.prompt && typeof template.prompt === "object") {
      raw = template.prompt as Record<string, unknown>;
    } else if (template.fullPrompt?.trim().startsWith("{")) {
      try {
        raw = JSON.parse(template.fullPrompt) as Record<string, unknown>;
      } catch {
        raw = { legacyFormat: "text", promptText: template.fullPrompt };
      }
    } else {
      raw = { legacyFormat: "text", promptText: template.fullPrompt ?? "" };
    }

    const normalized = normalizeNanoBananaPromptStructure(raw);
    const parsed = nanoBananaPromptJsonSchema.parse(normalized);

    return {
      name: template.name,
      workSurface: template.workSurface,
      aspectRatio: template.aspectRatio,
      prompt: parsed,
    };
  });

export const nanoBananaProSchema = z.object({
  workSurfaces: z.array(z.string()).min(1),
  sixComponentFormula: z.string(),
  mandatoryConstraints: z.array(z.string()).min(3),
  promptTemplates: z
    .array(nanoBananaPromptTemplateSchema)
    .min(2)
    .max(4),
});

export const brandDnaSchema = z.object({
  brandStyle: z.string(),
  visualDirection: z.string(),
  audienceProfile: z.string(),
  preferredColors: z.array(z.string()),
  compositionPreferences: z.array(z.string()),
  negativeStyles: z.array(z.string()),
  recommendedHooks: z.array(z.string()),
  visualKeywords: z.array(z.string()),
  productionRules: productionRulesSchema,
  referenceInsights: z.array(referenceInsightSchema).optional(),
  nanoBananaPro: nanoBananaProSchema,
});

export type BrandDnaInput = z.infer<typeof brandDnaSchema>;
export type ProductionRules = z.infer<typeof productionRulesSchema>;
export type NanoBananaProConfig = z.infer<typeof nanoBananaProSchema>;
export type NanoBananaPromptTemplate = z.infer<typeof nanoBananaPromptTemplateSchema>;
export type ReferenceInsight = z.infer<typeof referenceInsightSchema>;
