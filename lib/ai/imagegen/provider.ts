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
import { generateOpenAIImage, type OpenAIImageQuality } from "./openai";
import { urlsToInlineDataParts } from "./storage-refs";
import sharp from "sharp";

export type ImageProvider = "magnific" | "gemini" | "openai";

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
  /** Esforço do GPT Image (low/medium/high…). Ignorado por Magnific/Gemini. */
  quality?: OpenAIImageQuality;
  /** O prompt já descreve o papel de cada referência — não anexar a lista de novo. */
  referencesInPrompt?: boolean;
};

export function getImageProvider(): ImageProvider {
  const provider = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  if (provider === "gemini") return "gemini";
  if (provider === "openai") return "openai";
  return "magnific";
}

/** Gera a imagem e devolve os bytes em PNG, pronto para compor a logo. */
export async function generateArtImage(
  params: GenerateArtImageParams
): Promise<Buffer> {
  const references = params.references ?? [];
  const provider = getImageProvider();

  if (provider === "openai") {
    const { buffer } = await generateOpenAIImage({
      prompt: params.prompt,
      references: references.map((r) => ({ url: r.url, text: r.intent })),
      aspectRatio: params.aspectRatio ?? "3:4",
      resolution: params.imageSize ?? "2K",
      quality: params.quality ?? "medium",
      referencesInPrompt: params.referencesInPrompt,
    });
    return buffer;
  }

  if (provider === "gemini") {
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
