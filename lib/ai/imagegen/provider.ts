/**
 * Um único ponto de entrada para gerar imagem, seja qual for o provedor.
 *
 * O pipeline de artes (worker, stories, ajuste por instrução) chama só isto.
 * O provedor padrão é o **Magnific** (`MAGNIFIC_API_KEY`); o Gemini continua
 * no código e volta com `IMAGE_PROVIDER=gemini` — trocar de provedor no meio de
 * uma demanda é uma variável de ambiente, não um deploy.
 *
 * As referências trafegam como `{ url, intent }` e não como bytes: a Magnific
 * baixa a URL sozinha, e é só na ponta do Gemini que elas viram base64.
 */

import { generateArt, type AspectRatio, type ImageSize } from "./client";
import { generateMagnificImage } from "./magnific";
import { urlsToInlineDataParts } from "./storage-refs";
import sharp from "sharp";

export type ImageProvider = "magnific" | "gemini";

export type ArtReference = {
  url: string;
  /** O papel desta imagem NESTA arte. Vira o `text` da referência na Magnific. */
  intent?: string | null;
};

export type GenerateArtImageParams = {
  prompt: string;
  references?: ArtReference[];
  aspectRatio?: string;
  imageSize?: string;
};

export function getImageProvider(): ImageProvider {
  return process.env.IMAGE_PROVIDER?.trim().toLowerCase() === "gemini"
    ? "gemini"
    : "magnific";
}

/** Gera a imagem e devolve os bytes em PNG, pronto para compor a logo. */
export async function generateArtImage(
  params: GenerateArtImageParams
): Promise<Buffer> {
  const references = params.references ?? [];

  if (getImageProvider() === "gemini") {
    const parts = await urlsToInlineDataParts(references.map((r) => r.url));
    const generated = await generateArt({
      prompt: params.prompt,
      references: parts,
      imageSize: (params.imageSize as ImageSize) ?? "2K",
      aspectRatio: (params.aspectRatio as AspectRatio) ?? "3:4",
    });
    return sharp(Buffer.from(generated.base64, "base64")).png().toBuffer();
  }

  const { buffer } = await generateMagnificImage({
    prompt: params.prompt,
    references: references.map((r) => ({ url: r.url, text: r.intent })),
    aspectRatio: params.aspectRatio ?? "3:4",
    resolution: params.imageSize ?? "2K",
  });
  return buffer;
}
