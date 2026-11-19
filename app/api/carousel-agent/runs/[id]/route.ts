import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInstagramAdmin } from "@/lib/instagram/http";
import { INSTAGRAM_POSTS_BUCKET } from "@/lib/instagram/posts";
import { requireAgentOrAdmin } from "@/lib/carousel-agent/auth";
import { appUrl, getRun, publicRun } from "@/lib/carousel-agent/runs";
import { isStale } from "@/lib/carousel-agent/shape";

type Params = { params: Promise<{ id: string }> };

/** Status de um carrossel (o agente consulta aqui se não usar callback). */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireAgentOrAdmin(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const run = await getRun(createAdminClient(), id);
  if (!run) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
  return NextResponse.json(publicRun(run, appUrl()));
}

/**
 * Exclui o pedido (só admin logado). Não exclui enquanto está gerando.
 * Aprovado: some da aba, mas as imagens ficam, porque o post agendado no
 * Instagram usa elas (cancele o agendamento no histórico do post, se quiser).
 * Os demais: apaga também as imagens do Storage.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireInstagramAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const admin = createAdminClient();
  const run = await getRun(admin, id);
  if (!run) return NextResponse.json({ error: "Carrossel não encontrado" }, { status: 404 });
  if ((run.status === "generating" || run.status === "queued") && !isStale(run)) {
    return NextResponse.json({ error: "Ainda está gerando. Espere terminar para excluir." }, { status: 409 });
  }

  const { error } = await admin.from("carousel_agent_runs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (run.status !== "approved") {
    const paths = run.cards.map((c) => c.path).filter((p): p is string => !!p);
    if (paths.length) await admin.storage.from(INSTAGRAM_POSTS_BUCKET).remove(paths).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
