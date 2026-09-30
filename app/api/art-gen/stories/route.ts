/**
 * POST /api/art-gen/stories
 *
 * Gera em lote a versão 9:16 das artes APROVADAS da demanda. Não é uma nova
 * direção de arte: a peça 3:4 já passou pela curadoria, e o que se pede aqui é
 * o mesmo criativo reenquadrado (ver lib/ai/imagegen/story.ts).
 *
 * Só entram artes aprovadas e com imagem pronta — reenquadrar um rascunho seria
 * queimar crédito num layout que ainda vai mudar.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runStoryWorker } from "@/lib/ai/imagegen/worker";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { demandId?: string; jobIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { demandId, jobIds } = body;
  if (!demandId) {
    return NextResponse.json({ error: "demandId é obrigatório" }, { status: 400 });
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("art_generation_job")
    .select("id")
    .eq("demand_id", demandId)
    .eq("approved", true)
    .eq("status", "succeeded");

  if (jobIds?.length) query = query.in("id", jobIds);

  const { data: jobs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (jobs ?? []).map((j) => j.id as string);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma arte aprovada e pronta para adaptar" },
      { status: 422 }
    );
  }

  // Não re-enfileira o que já está a caminho: dois cliques seguidos no botão
  // não podem virar duas gerações da mesma arte.
  const { data: queued, error: updateError } = await supabase
    .from("art_generation_job")
    .update({ story_status: "queued", story_error: null, updated_at: new Date().toISOString() })
    .in("id", ids)
    .not("story_status", "in", "(queued,processing)")
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const count = (queued ?? []).length;
  if (count > 0) {
    after(() =>
      runStoryWorker(demandId).catch((err) => {
        console.error("[art-gen/stories]", (err as Error)?.message ?? err);
      })
    );
  }

  return NextResponse.json({ ok: true, queued: count });
}
