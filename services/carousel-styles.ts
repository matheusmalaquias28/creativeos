import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStyleDna, type StyleDna } from "@/lib/carousel-styles/dna";
import type { Database } from "@/types/database";
import { isStudioDocument, type StudioCarousel, type StudioDocument } from "@/types/carousel-studio";

type StyleRow = Database["public"]["Tables"]["carousel_styles"]["Row"];
export type CarouselStyleImage = Database["public"]["Tables"]["carousel_style_images"]["Row"];

export type CarouselStyle = Omit<StyleRow, "dna"> & {
  dna: StyleDna | null;
  images: CarouselStyleImage[];
};

/** Resumo para seletores (Studio): sem o DNA completo. */
export type CarouselStyleOption = Pick<CarouselStyle, "id" | "name" | "analysis_status"> & {
  coverUrl: string | null;
  imageCount: number;
  /** Todas as artes, na ordem — preview do estilo na hora de gerar. */
  imageUrls: string[];
  summary: string | null;
};

function assemble(styles: StyleRow[], images: CarouselStyleImage[]): CarouselStyle[] {
  const byStyle = new Map<string, CarouselStyleImage[]>();
  for (const image of images) {
    const list = byStyle.get(image.style_id) ?? [];
    list.push(image);
    byStyle.set(image.style_id, list);
  }
  return styles.map((s) => ({
    ...s,
    dna: isStyleDna(s.dna) ? s.dna : null,
    images: (byStyle.get(s.id) ?? []).sort((a, b) => a.position - b.position),
  }));
}

export async function listCarouselStyles(): Promise<CarouselStyle[]> {
  const supabase = await createClient();
  const { data: styles, error } = await supabase
    .from("carousel_styles")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!styles?.length) return [];

  const { data: images, error: imagesError } = await supabase
    .from("carousel_style_images")
    .select("*")
    .in("style_id", styles.map((s) => s.id));
  if (imagesError) throw new Error(imagesError.message);
  return assemble(styles, images ?? []);
}

export async function listCarouselStyleOptions(): Promise<CarouselStyleOption[]> {
  const styles = await listCarouselStyles();
  return styles.map((s) => ({
    id: s.id,
    name: s.name,
    analysis_status: s.analysis_status,
    coverUrl: s.images[0]?.storage_url ?? null,
    imageCount: s.images.length,
    imageUrls: s.images.map((i) => i.storage_url),
    summary: s.dna?.summary ?? null,
  }));
}

export async function getCarouselStyle(
  id: string,
  opts: { admin?: boolean } = {}
): Promise<CarouselStyle | null> {
  const supabase = opts.admin ? createAdminClient() : await createClient();
  const { data: style } = await supabase.from("carousel_styles").select("*").eq("id", id).maybeSingle();
  if (!style) return null;
  const { data: images } = await supabase
    .from("carousel_style_images")
    .select("*")
    .eq("style_id", id);
  return assemble([style], images ?? [])[0];
}

/** Documento de páginas-modelo do estilo (null = ainda não montado). */
export type StyleTemplateSummary = {
  id: string;
  status: StudioCarousel["status"];
  document: StudioDocument | null;
  generation: StudioCarousel["generation"];
};

export async function getStyleTemplateSummary(styleId: string): Promise<StyleTemplateSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_carousels")
    .select("id, status, document, generation")
    .eq("style_template_for", styleId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status as StudioCarousel["status"],
    document: isStudioDocument(data.document) ? data.document : null,
    generation: (data.generation ?? {}) as StudioCarousel["generation"],
  };
}
