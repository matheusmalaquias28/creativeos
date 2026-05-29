import { z } from "zod";

export const productionRulesSchema = z.object({
  layoutAndSpacing: z.array(z.string()).min(2),
  typography: z.array(z.string()).min(2),
  visualHierarchy: z.array(z.string()).min(2),
});

export const referenceInsightSchema = z.object({
  source: z.string(),
  visualRole: z.string(),
  signals: z.array(z.string()).min(1),
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
  productionRules: productionRulesSchema.optional(),
  referenceInsights: z.array(referenceInsightSchema).optional(),
});

export type BrandDnaInput = z.infer<typeof brandDnaSchema>;
export type ProductionRules = z.infer<typeof productionRulesSchema>;
export type ReferenceInsight = z.infer<typeof referenceInsightSchema>;
