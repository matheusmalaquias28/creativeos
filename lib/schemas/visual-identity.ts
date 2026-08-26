import { z } from "zod";
import { isValidHexColor, normalizeHexColor } from "@/lib/utils/color";

const hexColorSchema = z
  .string()
  .refine((v) => isValidHexColor(v), "Cor inválida")
  .transform((v) => normalizeHexColor(v)!);

export const visualIdentityDnaSchema = z.object({
  summary: z.string().min(20),
  palette: z.array(hexColorSchema).min(1).max(8),
  typography: z.object({
    headlineStyle: z.string(),
    bodyStyle: z.string(),
    notes: z.string().optional(),
  }),
  compositionStyle: z.string(),
  visualKeywords: z.array(z.string()).min(2).max(12),
  mood: z.string(),
  elementsToRepeat: z.array(z.string()).min(1).max(8),
  avoid: z.array(z.string()).optional(),
});

export type VisualIdentityDna = z.infer<typeof visualIdentityDnaSchema>;

export type IdentityExtractionStatus = "idle" | "extracting" | "ready" | "failed";

export type ClientVisualIdentityState = {
  identitySampleUrl: string | null;
  visualIdentityDna: VisualIdentityDna | null;
  identityExtractedAt: string | null;
  identityExtractionStatus: IdentityExtractionStatus;
  identityExtractionError: string | null;
  basePrompt: string;
  palette: string[];
};

export function isVisualIdentityReady(state: ClientVisualIdentityState): boolean {
  return state.identityExtractionStatus === "ready" && Boolean(state.visualIdentityDna);
}
