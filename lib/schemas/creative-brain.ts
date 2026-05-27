import { z } from "zod";

export const brandDnaSchema = z.object({
  brandStyle: z.string(),
  visualDirection: z.string(),
  audienceProfile: z.string(),
  preferredColors: z.array(z.string()),
  compositionPreferences: z.array(z.string()),
  negativeStyles: z.array(z.string()),
  recommendedHooks: z.array(z.string()),
  visualKeywords: z.array(z.string()),
});

export type BrandDnaInput = z.infer<typeof brandDnaSchema>;
