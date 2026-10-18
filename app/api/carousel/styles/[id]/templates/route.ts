import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureStyleTemplate, runTemplateDraft } from "@/lib/carousel-styles/templates";
import { isStudioBusy, isStudioDocument, type StudioStatus } from "@/types/carousel-studio";

// Uma chamada de visão por arte (3 em paralelo) + recortes: ~1–3 min.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * Monta (ou remonta, com `replace: true`) o rascunho das páginas-modelo do
 * estilo a partir das artes. Volta na hora com o id do documento; o editor
 * acompanha o progresso.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { replace?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body opcional
  }

  const admin = createAdminClient();
  const { data: style } = await admin.from("carousel_styles").select("id, name, active").eq("id", id).maybeSingle();
  if (!style?.active) return NextResponse.json({ error: "Estilo não encontrado" }, { status: 404 });
  const { count } = await admin.from("carousel_style_images").select("id", { count: "exact", head: true }).eq("style_id", id);
  if (!count) return NextResponse.json({ error: "Suba as artes do estilo antes" }, { status: 400 });

  const templateId = await ensureStyleTemplate(id, style.name);
  const { data: template } = await admin.from("studio_carousels").select("status, document").eq("id", templateId).maybeSingle();
  if (template && isStudioBusy(template.status as StudioStatus)) {
    return NextResponse.json({ templateId, started: false });
  }
  const hasPages = isStudioDocument(template?.document) && template.document.pages.length > 0;
  if (hasPages && body.replace !== true) {
    return NextResponse.json({ templateId, started: false });
  }

  await admin
    .from("studio_carousels")
    .update({ status: "queued", generation: { stage: "queued", message: "Na fila…" } })
    .eq("id", templateId);
  after(() => runTemplateDraft(templateId, id).catch((e) => console.error("[carousel-styles/templates]", e)));
  return NextResponse.json({ templateId, started: true });
}
