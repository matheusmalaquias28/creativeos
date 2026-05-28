import type Anthropic from "@anthropic-ai/sdk";
import type { ClientReference } from "@/types";
import { fetchValidatedVisionImage } from "@/lib/utils/vision-image";

/** Máximo de imagens de referência enviadas ao Claude Vision. */
const MAX_IMAGES = 3;

type ImageBlock = Anthropic.Messages.ImageBlockParam;

function guessMimeHint(ref: ClientReference): string | undefined {
  if (ref.mime_type?.startsWith("image/")) return ref.mime_type;
  const lower = ref.file_name.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

/**
 * Blocos de imagem para Claude Vision — referências + logo (sem SVG).
 * Fetches em paralelo para reduzir latência.
 */
export async function buildClaudeReferenceImageBlocks(
  references: ClientReference[],
  logoUrl?: string
): Promise<{ blocks: ImageBlock[]; labels: string[]; skipped: string[] }> {
  const blocks: ImageBlock[] = [];
  const labels: string[] = [];
  const skipped: string[] = [];

  const sorted = [...references].sort((a, b) => a.sort_order - b.sort_order);
  const candidates = sorted.slice(0, MAX_IMAGES);

  // Fetch todas as referências em paralelo
  const refResults = await Promise.all(
    candidates.map(async (ref) => {
      if (guessMimeHint(ref) === "image/svg+xml") {
        return { ok: false as const, label: `reference:${ref.file_name} (SVG)` };
      }
      const validated = await fetchValidatedVisionImage(ref.public_url, ref.file_name);
      return validated
        ? { ok: true as const, validated, label: `reference:${ref.file_name}` }
        : { ok: false as const, label: `reference:${ref.file_name}` };
    })
  );

  for (const r of refResults) {
    if (r.ok) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: r.validated.mimeType, data: r.validated.base64 },
      });
      labels.push(r.label);
    } else {
      skipped.push(r.label);
    }
  }

  if (logoUrl && blocks.length < MAX_IMAGES) {
    const validated = await fetchValidatedVisionImage(logoUrl, "client-logo");
    if (validated) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: validated.mimeType, data: validated.base64 },
      });
      labels.push("logo:client");
    } else {
      skipped.push("logo:client (SVG ou formato inválido)");
    }
  }

  return { blocks, labels, skipped };
}
