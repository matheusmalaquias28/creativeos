import { randomUUID } from "crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateArtImage, type ArtReference } from "@/lib/ai/imagegen/provider";
import { removeFlatBackground } from "./cutout";

/**
 * Imagens do Carrossel Studio: gerar (fundo / elemento), editar por instrução
 * e recortar fundo. Usa o mesmo provedor do resto do sistema
 * (`IMAGE_PROVIDER`), sobe no bucket público `generated-images` e devolve a URL
 * permanente.
 */

const BUCKET = "generated-images";

export type StudioImageKind = "background" | "element";

export type StudioImageResult = { url: string; width: number; height: number };

export async function uploadStudioImage(
  carouselId: string,
  buffer: Buffer,
  contentType: "image/png" | "image/jpeg" | "image/webp"
): Promise<string> {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `carousel-studio/${carouselId}/${randomUUID()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Falha ao salvar a imagem: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Referências de estilo no formato do provedor (máx. 4 — teto da Magnific). */
export function styleReferences(urls: string[]): ArtReference[] {
  return Array.from(new Set(urls))
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 4)
    .map((url) => ({
      url,
      intent: "Referência de estilo visual, luz, textura e paleta. NÃO copie o conteúdo, os textos nem a composição literal.",
    }));
}

async function finalize(carouselId: string, png: Buffer, kind: StudioImageKind): Promise<StudioImageResult> {
  if (kind === "element") {
    const cut = await removeFlatBackground(png);
    const url = await uploadStudioImage(carouselId, cut.buffer, "image/png");
    return { url, width: cut.width, height: cut.height };
  }
  // Fundo não precisa de alpha: JPEG de alta qualidade pesa ~5x menos.
  const jpeg = await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  const url = await uploadStudioImage(carouselId, jpeg, "image/jpeg");
  return { url, width: meta.width ?? 0, height: meta.height ?? 0 };
}

export async function generateStudioImage(params: {
  carouselId: string;
  kind: StudioImageKind;
  prompt: string;
  aspectRatio: string;
  referenceUrls?: string[];
}): Promise<StudioImageResult> {
  const png = await generateArtImage({
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    imageSize: "2K",
    quality: "medium",
    // Elemento recortado não deve herdar o cenário das referências.
    references: params.kind === "background" ? styleReferences(params.referenceUrls ?? []) : [],
  });
  return finalize(params.carouselId, png, params.kind);
}

export async function editStudioImage(params: {
  carouselId: string;
  kind: StudioImageKind;
  sourceUrl: string;
  instruction: string;
  aspectRatio: string;
}): Promise<StudioImageResult> {
  const prompt = [
    `Edite a imagem de referência aplicando esta alteração: ${params.instruction.trim()}.`,
    "Preserve todo o resto: enquadramento, sujeito, estilo, luz e cores, exceto o que a alteração pede.",
    params.kind === "element" ? "Mantenha o objeto isolado sobre fundo branco puro e liso (#FFFFFF)." : "",
    "A imagem NÃO pode conter texto, letras, números, logotipos ou marca d'água.",
  ]
    .filter(Boolean)
    .join(" ");
  const png = await generateArtImage({
    prompt,
    aspectRatio: params.aspectRatio,
    imageSize: "2K",
    quality: "medium",
    references: [{ url: params.sourceUrl, intent: "Imagem base a ser editada. Mantenha a composição." }],
  });
  return finalize(params.carouselId, png, params.kind);
}

export async function cutoutFromUrl(carouselId: string, sourceUrl: string): Promise<StudioImageResult & { removed: boolean }> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Não foi possível baixar a imagem (${res.status})`);
  const cut = await removeFlatBackground(Buffer.from(await res.arrayBuffer()));
  if (!cut.removed) {
    return { url: sourceUrl, width: cut.width, height: cut.height, removed: false };
  }
  const url = await uploadStudioImage(carouselId, cut.buffer, "image/png");
  return { url, width: cut.width, height: cut.height, removed: true };
}

/** Prompt livre do operador → prompt com as regras do Studio (sem texto, recorte). */
export function wrapOperatorPrompt(kind: StudioImageKind, prompt: string, imageStyle?: string | null): string {
  const parts = [prompt.trim()];
  if (kind === "element") {
    parts.push(
      "Objeto único, isolado e centralizado, inteiro dentro do quadro com margem em volta.",
      "Fundo branco puro (#FFFFFF), liso e uniforme, sem sombra projetada no chão, sem cenário."
    );
  }
  if (imageStyle?.trim()) parts.push(`Direção visual: ${imageStyle.trim()}`);
  parts.push("A imagem NÃO pode conter nenhum texto, letra, número, palavra, logotipo, marca d'água ou interface.");
  return parts.join(" ");
}
