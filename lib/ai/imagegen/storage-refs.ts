/**
 * Baixa imagens do Supabase Storage (ou qualquer URL) como bytes originais
 * e monta as `InlineDataPart` para enviar ao Gemini como referências.
 * Os bytes não são reprocessados — chegam ao modelo como estão no Storage.
 */

import type { InlineDataPart } from "./client";

type FetchedRef = InlineDataPart & { url: string };

function mimeTypeFromUrl(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid data URL for reference image");
    }
    return { mimeType: match[1], base64: match[2] };
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch reference image: ${res.status} ${url}`);
  }
  const contentType = res.headers.get("content-type") ?? mimeTypeFromUrl(url);
  const mimeType = contentType.split(";")[0].trim();
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { base64, mimeType };
}

/**
 * Converte uma lista de URLs de imagens em InlineDataParts.
 * Ignora URLs que falham individualmente (loga o erro, não interrompe o lote).
 * Limita a 14 referências (máximo do modelo).
 */
export async function urlsToInlineDataParts(
  urls: string[],
  maxRefs = 14
): Promise<FetchedRef[]> {
  const limited = urls.slice(0, maxRefs);

  const settled = await Promise.allSettled(
    limited.map(async (url): Promise<FetchedRef> => {
      const { base64, mimeType } = await fetchAsBase64(url);
      return { url, inlineData: { mimeType, data: base64 } };
    })
  );

  const parts: FetchedRef[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      parts.push(result.value);
    } else {
      // Não loga URL para evitar vazar caminhos internos em produção
      console.warn("[imagegen/storage-refs] Failed to fetch reference image:", result.reason?.message);
    }
  }

  return parts;
}

/**
 * Lê os bytes de uma única URL e retorna InlineDataPart.
 * Usado para carregar a imagem atual antes de um ajuste.
 */
export async function urlToInlineDataPart(url: string): Promise<InlineDataPart> {
  const { base64, mimeType } = await fetchAsBase64(url);
  return { inlineData: { mimeType, data: base64 } };
}
