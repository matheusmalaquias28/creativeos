import { z } from "zod";
import { isValidHexColor, normalizeHexColor } from "@/lib/utils/color";

const hexColorSchema = z
  .string()
  .refine((v) => isValidHexColor(v), "Cor inválida")
  .transform((v) => normalizeHexColor(v)!);

// O texto do DNA é só uma legenda de apoio — a arte de referência enviada junto
// é a fonte visual principal. Os clamps abaixo garantem um prompt enxuto mesmo
// se o modelo ignorar os limites de palavras pedidos no system prompt (ver
// VISUAL_IDENTITY_SYSTEM_PROMPT), evitando estourar o limite de ~4000 chars do
// spaces_edit quando o DNA entra no prompt do Space (build-space-query.ts).
export const visualIdentityDnaSchema = z.object({
  summary: z.string().min(20).transform((v) => v.trim().slice(0, 160)),
  palette: z.array(hexColorSchema).min(1).max(8),
  typography: z.object({
    headlineStyle: z.string().transform((v) => v.trim().slice(0, 60)),
    bodyStyle: z.string().transform((v) => v.trim().slice(0, 60)),
    notes: z.string().optional().transform((v) => v?.trim().slice(0, 60)),
  }),
  compositionStyle: z.string().transform((v) => v.trim().slice(0, 100)),
  visualKeywords: z
    .array(z.string())
    .min(2)
    .transform((arr) => arr.slice(0, 6).map((v) => v.trim().slice(0, 30))),
  mood: z.string().transform((v) => v.trim().slice(0, 40)),
  elementsToRepeat: z
    .array(z.string())
    .min(1)
    .transform((arr) => arr.slice(0, 4).map((v) => v.trim().slice(0, 40))),
  avoid: z
    .array(z.string())
    .optional()
    .transform((arr) => arr?.slice(0, 3).map((v) => v.trim().slice(0, 40))),
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
