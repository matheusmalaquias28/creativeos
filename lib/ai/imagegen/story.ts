/**
 * Adaptação da arte aprovada para o formato stories (9:16).
 *
 * Não é uma nova direção de arte: a arte 3:4 já foi aprovada pelo operador, e
 * o que se quer aqui é a MESMA peça reenquadrada. Por isso a arte entra como
 * referência única e o prompt é uma instrução de reenquadramento — nada de
 * catálogo, briefing ou bloco técnico, que reabririam decisões já fechadas.
 */

import { generateArt, type AspectRatio, type ImageSize, type InlineDataPart } from "./client";

/** Formato do story. Fixo: é o que a etapa inteira existe para produzir. */
export const STORY_ASPECT_RATIO: AspectRatio = "9:16";

/** A instrução do operador, literal. É ela que define a etapa. */
export const STORY_ADAPT_PROMPT =
  "Adapte essas artes para o formato stories 9:16, sem adicionar textos e distorcer imagens";

/**
 * Reforço determinístico em inglês. O modelo de imagem entende a instrução em
 * português, mas "sem distorcer" e "sem adicionar texto" são exatamente os dois
 * erros que ele comete de qualquer forma — estender o fundo, e não esticar a
 * arte, é a parte que precisa estar dita com precisão.
 */
const STORY_STANDARDS = [
  "PRODUCTION STANDARDS — NON-NEGOTIABLE",
  "- Reframe the reference ad to a 9:16 vertical story canvas. Keep the SAME design: same photograph or illustration, same typography, same colours, same logo, same button.",
  "- Never stretch, squash, crop or resample the artwork to fit. Keep every element at its original proportions; extend the existing background upwards and downwards to fill the taller canvas, continuing its colour, gradient, grain and lighting seamlessly.",
  "- Re-space the existing blocks vertically to breathe in the taller canvas. Do not resize text relative to the artwork beyond what the new spacing requires.",
  "- Add NO new text, no new words, no captions, no stickers, no UI chrome, no watermark, no extra logo. Every readable word in the output already exists in the reference, spelled and cased identically.",
  "- Safe area: keep all text, the logo and the button inside the central 80% of the height and at least 8% from the left and right edges, clear of the Instagram story UI.",
].join("\n");

export function buildStoryPrompt(extra?: string | null): string {
  return [STORY_ADAPT_PROMPT, extra?.trim() || null, STORY_STANDARDS]
    .filter(Boolean)
    .join("\n\n");
}

export function bufferToInlineData(buffer: Buffer, mimeType = "image/png"): InlineDataPart {
  return { inlineData: { mimeType, data: buffer.toString("base64") } };
}

/**
 * Gera o story a partir do PNG final da arte (já com a logo composta — a logo
 * não é recomposta depois, senão ela apareceria duas vezes).
 */
export async function adaptArtToStory(params: {
  art: Buffer;
  imageSize?: ImageSize;
  extraInstruction?: string | null;
}): Promise<Buffer> {
  const generated = await generateArt({
    prompt: buildStoryPrompt(params.extraInstruction),
    references: [bufferToInlineData(params.art)],
    imageSize: params.imageSize ?? "2K",
    aspectRatio: STORY_ASPECT_RATIO,
  });

  return Buffer.from(generated.base64, "base64");
}
