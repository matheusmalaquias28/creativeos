import { createAdminClient } from "@/lib/supabase/admin";
import { toStudioCarousel } from "@/services/carousel-studio";
import type { StudioCarousel } from "@/types/carousel-studio";
import { toInstagramJpeg } from "./jpeg";
import { CAROUSEL_MAX_ITEMS, CAROUSEL_MIN_ITEMS } from "./publish";

/**
 * Prepara as páginas de um carrossel do Studio para o Instagram.
 *
 * O Studio só renderiza no navegador (html-to-image), então o servidor não
 * consegue gerar as páginas sozinho. A fonte são os PNGs que o editor já sobe
 * em "Enviar para a demanda" (`uploadPageToDemand` → bucket `demand-exports`,
 * slots `feed` 1..N em `demand_export_files`). Cada PNG vira JPEG e vai para
 * o bucket público `generated-images`, que é o que o Instagram baixa.
 */

const SOURCE_BUCKET = "demand-exports";
const TARGET_BUCKET = "generated-images";

export class StudioImagesError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "StudioImagesError";
  }
}

export type PreparedStudioCarousel = {
  carousel: StudioCarousel;
  imageUrls: string[];
  /** Avisos que não impedem publicar (ex.: export mais antigo que a última edição). */
  warnings: string[];
};

/** 9:16 é formato de Stories — não entra em carrossel do feed. */
export function assertFeedFormat(format: string): void {
  if (format === "9:16") {
    throw new StudioImagesError(
      "Carrossel em 9:16 não pode ser publicado no feed: o Instagram só aceita de 4:5 a 1.91:1. Mude o formato para 4:5 ou 1:1.",
      422
    );
  }
}

export async function prepareStudioCarouselImages(carouselId: string): Promise<PreparedStudioCarousel> {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("studio_carousels").select("*").eq("id", carouselId).maybeSingle();
  if (error) throw new StudioImagesError(error.message, 500);
  if (!row) throw new StudioImagesError("Carrossel não encontrado", 404);

  const carousel = toStudioCarousel(row);
  assertFeedFormat(carousel.format);

  const pageCount = carousel.document.pages.length;
  if (pageCount < CAROUSEL_MIN_ITEMS || pageCount > CAROUSEL_MAX_ITEMS) {
    throw new StudioImagesError(
      `O carrossel tem ${pageCount} página(s); a API do Instagram aceita de ${CAROUSEL_MIN_ITEMS} a ${CAROUSEL_MAX_ITEMS}.`,
      422
    );
  }
  if (!carousel.demand_id) {
    throw new StudioImagesError(
      "Este carrossel não está ligado a uma demanda. O teste usa as páginas enviadas para a entrega da demanda.",
      422
    );
  }

  const { data: files, error: filesError } = await admin
    .from("demand_export_files")
    .select("art_index, storage_path, drive_file_id, updated_at")
    .eq("demand_id", carousel.demand_id)
    .eq("format", "feed")
    .gte("art_index", 1)
    .lte("art_index", pageCount)
    .order("art_index", { ascending: true });
  if (filesError) throw new StudioImagesError(filesError.message, 500);

  const byIndex = new Map((files ?? []).map((f) => [f.art_index, f]));
  const missing = Array.from({ length: pageCount }, (_, i) => i + 1).filter((i) => !byIndex.has(i));
  if (missing.length) {
    throw new StudioImagesError(
      `Faltam as páginas ${missing.join(", ")} na entrega da demanda. No editor do Studio, use "Enviar para a demanda" antes de publicar.`,
      422
    );
  }

  const warnings: string[] = [];
  const oldestExport = Math.min(...[...byIndex.values()].map((f) => Date.parse(f.updated_at)));
  if (Date.parse(carousel.updated_at) > oldestExport) {
    warnings.push("O carrossel foi editado depois do último envio para a demanda — as páginas publicadas podem estar desatualizadas.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const imageUrls: string[] = [];
  for (let index = 1; index <= pageCount; index++) {
    const file = byIndex.get(index)!;
    const { data: blob, error: downloadError } = await admin.storage.from(SOURCE_BUCKET).download(file.storage_path);
    if (downloadError || !blob) {
      throw new StudioImagesError(
        file.drive_file_id
          ? `A página ${index} já foi entregue ao Drive e saiu do Storage. Envie as páginas para a demanda de novo.`
          : `Não foi possível ler a página ${index}: ${downloadError?.message ?? "arquivo vazio"}`,
        422
      );
    }

    let jpeg;
    try {
      jpeg = await toInstagramJpeg(Buffer.from(await blob.arrayBuffer()));
    } catch (e) {
      throw new StudioImagesError(`Página ${index}: ${e instanceof Error ? e.message : "falha na conversão"}`, 422);
    }

    const path = `instagram/${carousel.id}/${stamp}/page-${String(index).padStart(2, "0")}.jpg`;
    const { error: uploadError } = await admin.storage
      .from(TARGET_BUCKET)
      .upload(path, jpeg.buffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw new StudioImagesError(`Falha ao salvar a página ${index}: ${uploadError.message}`, 500);
    imageUrls.push(admin.storage.from(TARGET_BUCKET).getPublicUrl(path).data.publicUrl);
  }

  return { carousel, imageUrls, warnings };
}
