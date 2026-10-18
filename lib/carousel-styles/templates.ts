/**
 * Páginas-modelo de um estilo: um documento do Carrossel Studio (linha de
 * `studio_carousels` com `style_template_for`), editado no mesmo editor.
 *
 * O rascunho roda em background (after()) e usa os mesmos campos `status` /
 * `generation` de um carrossel comum — o editor mostra o progresso sozinho.
 */

import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCarouselStyle } from "@/services/carousel-styles";
import {
  STUDIO_FORMATS,
  isStudioDocument,
  type StudioDocument,
  type StudioGeneration,
  type StudioPage,
} from "@/types/carousel-studio";
import type { Json } from "@/types/database";
import { draftTemplatePages } from "./template-draft";

/** Modelos são desenhados em 4:5; outros formatos são adaptados na geração. */
export const TEMPLATE_FORMAT = "4:5" as const;

function asJson(value: unknown): Json {
  return value as Json;
}

/** Garante a linha do documento de modelos do estilo (cria vazia). */
export async function ensureStyleTemplate(styleId: string, styleName: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("studio_carousels")
    .select("id")
    .eq("style_template_for", styleId)
    .maybeSingle();
  if (existing) return existing.id;

  const size = STUDIO_FORMATS[TEMPLATE_FORMAT];
  const { data, error } = await supabase
    .from("studio_carousels")
    .insert({
      style_template_for: styleId,
      name: `Modelos · ${styleName}`,
      format: TEMPLATE_FORMAT,
      status: "idle",
      document: asJson({ version: 1, format: TEMPLATE_FORMAT, width: size.width, height: size.height, pages: [] }),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível criar as páginas-modelo");
  return data.id;
}

/** Páginas-modelo prontas para a geração (só as que têm algum campo). */
export async function loadStyleTemplatePages(styleId: string): Promise<StudioPage[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("studio_carousels")
    .select("document, status")
    .eq("style_template_for", styleId)
    .maybeSingle();
  if (!data || !isStudioDocument(data.document)) return [];
  return (data.document as StudioDocument).pages.filter((p) => p.layers.some((l) => l.slot));
}

export async function runTemplateDraft(templateId: string, styleId: string): Promise<void> {
  const supabase = createAdminClient();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  let generation: StudioGeneration = {
    runId,
    stage: "planning",
    message: "Desmontando as artes do estilo em camadas…",
    done: 0,
    total: 0,
    error: null,
    startedAt,
  };
  await supabase
    .from("studio_carousels")
    .update({ status: "generating", generation: asJson(generation) })
    .eq("id", templateId);

  try {
    const style = await getCarouselStyle(styleId, { admin: true });
    if (!style) throw new Error("Estilo não encontrado");
    if (style.images.length === 0) throw new Error("O estilo não tem artes");

    const size = STUDIO_FORMATS[TEMPLATE_FORMAT];
    generation = { ...generation, stage: "images", total: style.images.length, message: `Desmontando ${style.images.length} artes…` };
    await supabase.from("studio_carousels").update({ generation: asJson(generation) }).eq("id", templateId);

    const { pages, failed } = await draftTemplatePages({
      templateId,
      images: style.images.map((i) => ({ url: i.storage_url, role: i.role })),
      dna: style.dna,
      width: size.width,
      height: size.height,
      onProgress: async (done, total) => {
        generation = { ...generation, done, message: `Artes desmontadas: ${done}/${total}` };
        await supabase.from("studio_carousels").update({ generation: asJson(generation) }).eq("id", templateId);
      },
    });
    if (pages.length === 0) throw new Error("Nenhuma arte pôde ser desmontada");

    // A capa vem primeiro e o CTA por último, como num carrossel.
    const order = { cover: 0, inner: 1, cta: 2 } as const;
    pages.sort((a, b) => order[a.templateRole ?? "inner"] - order[b.templateRole ?? "inner"]);

    const document: StudioDocument = {
      version: 1,
      format: TEMPLATE_FORMAT,
      width: size.width,
      height: size.height,
      pages,
    };
    await supabase
      .from("studio_carousels")
      .update({
        status: "ready",
        document: asJson(document),
        thumbnail_url: null,
        generation: asJson({
          ...generation,
          stage: "done",
          message: "Páginas-modelo prontas.",
          error: failed ? `${failed} arte(s) não puderam ser desmontadas` : null,
          finishedAt: new Date().toISOString(),
        }),
      })
      .eq("id", templateId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao montar as páginas-modelo";
    console.error("[carousel-styles/templates]", styleId, message);
    await supabase
      .from("studio_carousels")
      .update({
        status: "failed",
        generation: asJson({ ...generation, stage: "failed", error: message, finishedAt: new Date().toISOString() }),
      })
      .eq("id", templateId);
  }
}
