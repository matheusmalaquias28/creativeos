import { z } from "zod";
import { isValidHexColor, normalizeHexColor } from "@/lib/utils/color";

// Filtra e normaliza em vez de rejeitar: o Claude às vezes devolve mais de 8
// cores ou alguma entrada fora do formato hex (ex: "gradiente azul-roxo") — em
// vez de derrubar a extração inteira por causa de UM item ruim, descarta só o
// item inválido e corta no limite.
function preprocessPalette(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .filter((v): v is string => typeof v === "string" && isValidHexColor(v))
    .map((v) => normalizeHexColor(v)!)
    .slice(0, 8);
}

// O texto do DNA é só uma legenda de apoio — a arte de referência enviada junto
// é a fonte visual principal. Os clamps abaixo garantem um prompt enxuto mesmo
// se o modelo ignorar os limites de palavras pedidos no system prompt (ver
// VISUAL_IDENTITY_SYSTEM_PROMPT), evitando estourar o limite de ~4000 chars do
// spaces_edit quando o DNA entra no prompt do Space (build-space-query.ts).
export const visualIdentityDnaSchema = z.object({
  summary: z.string().min(20).transform((v) => v.trim().slice(0, 160)),
  palette: z.preprocess(preprocessPalette, z.array(z.string()).min(1, "Nenhuma cor válida extraída")),
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
