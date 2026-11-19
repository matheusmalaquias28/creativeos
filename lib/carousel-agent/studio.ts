/**
 * Formato "studio" do Agente de Carrossel.
 *
 *   cards do agente ─▶ carrossel do Studio (estilo do acervo) ─▶ diretor escolhe a
 *   página-modelo de cada card e preenche os campos ─▶ fotos dos campos de imagem
 *   (IA, com o teto de gasto) ─▶ cada página desenhada no servidor (server-render)
 *
 * O texto nunca passa por modelo de imagem: sai exato. O carrossel fica salvo no
 * Studio (editável no editor); "Refazer" na aba desenha de novo a partir do
 * documento atual, então ajustes feitos no editor entram no card.
 */

import type { Json } from "@/types/database";
import { isStudioDocument, type StudioDocument } from "@/types/carousel-studio";
import { pageTexts, studioCardsToArtes } from "./studio-shape";
import { runStudioGeneration } from "@/lib/carousel-studio/generate";
import { renderStudioPage } from "@/lib/carousel-studio/server-render";
import { loadStyleTemplatePages } from "@/lib/carousel-styles/templates";
import { getCarouselStyle } from "@/services/carousel-styles";
import type { CarouselProfile } from "@/types/carousel-profile";
import type { Admin } from "./runs";
import { downloadImage } from "./images";
import { lightLogoVersion, toTransparent } from "./logo";

/** Bucket público das imagens do Studio (o editor lê as logos daqui). */
const STUDIO_LOGO_BUCKET = "art-generations";
import type { AgentPlan, AgentRun } from "./types";

export { pageTexts, studioCardsToArtes } from "./studio-shape";

export async function loadStudioDocument(admin: Admin, id: string): Promise<StudioDocument> {
  const { data } = await admin.from("studio_carousels").select("document").eq("id", id).maybeSingle();
  if (!data || !isStudioDocument(data.document)) throw new Error("O carrossel do Studio deste pedido não foi encontrado.");
  return data.document as StudioDocument;
}

/**
 * Monta o carrossel no Studio (uma vez por pedido) e devolve o plano da aba.
 * Imagens dos campos de imagem passam por `reserveImage` (teto do agente).
 */
export async function planStudioRun(
  admin: Admin,
  run: AgentRun,
  profile: CarouselProfile,
  reserveImage: () => Promise<boolean>
): Promise<{ plan: AgentPlan; studioCarouselId: string; failedImages: number }> {
  const styleId = run.options.styleId;
  const cards = run.options.studioCards ?? [];
  if (!styleId) throw new Error("Pedido studio sem styleId.");
  if (!cards.length) throw new Error("Pedido studio sem cards.");

  const style = await getCarouselStyle(styleId, { admin: true });
  if (!style || !style.active) throw new Error("Estilo do Studio não encontrado.");

  let id = run.options.studioCarouselId ?? null;
  if (!id) {
    const brief = [
      run.options.visualDirection ? `Direção visual: ${run.options.visualDirection}` : "",
      run.input.includes("Contexto do pedido:") ? run.input.slice(run.input.indexOf("Contexto do pedido:")) : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const { data, error } = await admin
      .from("studio_carousels")
      .insert({
        name: `Agente · ${cards[0].text.split("\n")[0].slice(0, 80)}`,
        client_id: profile.client_id,
        style_id: styleId,
        format: "4:5",
        status: "queued",
        brief: brief || null,
        document: { version: 1, format: "4:5", width: 1080, height: 1350, pages: [] } as unknown as Json,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Não foi possível criar o carrossel no Studio.");
    id = data.id;
  }

  await runStudioGeneration(id, {
    artes: studioCardsToArtes(cards),
    handle: profile.instagram_handle,
    // Logo do perfil de design (PNG transparente); a da ficha pode ter fundo branco.
    logoUrl: profile.logo_url,
    reserveImage,
  });

  if (profile.logo_url) {
    await applyStudioLogos(admin, id, profile).catch((e) =>
      console.error("[carousel-agent/studio] logo não ajustada", e instanceof Error ? e.message : e)
    );
  }

  const { data: row } = await admin
    .from("studio_carousels")
    .select("status, document, caption, generation")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.status === "failed" || !isStudioDocument(row.document)) {
    const generation = (row?.generation ?? {}) as { error?: string | null };
    throw new Error(generation.error || "O Studio não conseguiu montar o carrossel.");
  }
  const document = row.document as StudioDocument;
  if (!document.pages.length) throw new Error("O Studio não montou nenhuma página.");

  const failedImages = document.pages
    .flatMap((p) => p.layers)
    .filter((l) => l.type === "image" && l.status === "failed").length;

  const plan: AgentPlan = {
    title: cards[0].text.split("\n")[0].replace(/\*/g, "").slice(0, 80),
    styleGuide: `Estilo "${style.name}" do Carrossel Studio (páginas-modelo).`,
    cards: document.pages.map((page) => {
      const { texts, cta } = pageTexts(page);
      return { texts, cta, visual: page.name };
    }),
    caption: row.caption ?? "",
    hashtags: [],
  };
  return { plan, studioCarouselId: id, failedImages };
}

/**
 * Logo nos modelos: versão transparente escura e versão clara (texto branco,
 * cores vivas mantidas) do perfil de design. Camada de logo com "clara" no nome
 * recebe a clara (foto ou fundo escuro); as demais, a escura. Sobe as duas no
 * Storage (sobrescreve) e grava no documento do Studio.
 */
async function applyStudioLogos(admin: Admin, studioId: string, profile: CarouselProfile): Promise<void> {
  const document = await loadStudioDocument(admin, studioId);
  const logoLayers = document.pages
    .flatMap((p) => p.layers)
    .filter((l): l is Extract<typeof l, { type: "image" }> => l.type === "image" && l.src === profile.logo_url);
  if (!logoLayers.length) return;

  const dark = await toTransparent(await downloadImage(profile.logo_url!));
  const light = profile.logo_light_url
    ? await toTransparent(await downloadImage(profile.logo_light_url))
    : await lightLogoVersion(dark);
  const stamp = Date.now();
  const upload = async (name: string, png: Buffer) => {
    const path = `carousel-agent/logos/${profile.id}-${name}.png`;
    const { error } = await admin.storage
      .from(STUDIO_LOGO_BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw new Error(error.message);
    return `${admin.storage.from(STUDIO_LOGO_BUCKET).getPublicUrl(path).data.publicUrl}?v=${stamp}`;
  };
  const [darkUrl, lightUrl] = await Promise.all([upload("dark", dark), upload("light", light)]);
  for (const layer of logoLayers) {
    layer.src = /clara|light/i.test(layer.name) ? lightUrl : darkUrl;
    layer.fit = "contain";
  }
  await admin
    .from("studio_carousels")
    .update({ document: document as unknown as Json })
    .eq("id", studioId);
}

/** Desenha uma página do carrossel do Studio (PNG 1080×1350). */
export async function renderStudioCard(document: StudioDocument, index: number): Promise<Buffer> {
  const page = document.pages[index];
  if (!page) throw new Error(`O carrossel do Studio não tem a página ${index + 1}.`);
  return renderStudioPage(page, { width: document.width, height: document.height });
}

/** Estilos do acervo com páginas-modelo, para o agente escolher (GET /styles). */
export async function listAgentStyles(admin: Admin) {
  const { data: styles } = await admin
    .from("carousel_styles")
    .select("id, name, description, client_id")
    .eq("active", true)
    .order("name");
  const out = [];
  for (const s of styles ?? []) {
    const pages = await loadStyleTemplatePages(s.id);
    if (!pages.length) continue;
    out.push({
      id: s.id,
      name: s.name,
      description: s.description,
      clientId: s.client_id,
      templates: pages.map((p, i) => ({
        code: `M${i + 1}`,
        role: p.templateRole ?? "inner",
        name: p.name,
        fields: p.layers
          .filter((l) => l.slot && l.slot !== "logo")
          .map((l) => ({
            slot: l.slot,
            sample: l.type === "text" || l.type === "button" ? l.text : null,
          })),
      })),
    });
  }
  return out;
}
