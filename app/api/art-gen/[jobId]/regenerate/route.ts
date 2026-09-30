/**
 * POST /api/art-gen/[jobId]/regenerate
 *
 * Gera de novo UMA arte, opcionalmente com o prompt alterado pelo operador.
 * Diferente de /redirect (que reescreve o briefing com o diretor de arte) e de
 * /adjust (que edita a imagem existente): aqui o prompt é o que o operador
 * mandou e a imagem nasce do zero.
 *
 * O resultado entra como uma versão NOVA do job (v2, v3…) — a anterior continua
 * no histórico e pode ser restaurada. Antes disso o worker gravava sempre v1 e
 * a segunda geração morria no unique (job_id, version_number).
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import type { Database } from "@/types/database";

export const maxDuration = 300;

/** De onde dá para regerar. 'queued'/'processing' já estão a caminho. */
const REGENERABLE = ["awaiting_approval", "succeeded", "failed"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { prompt?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("art_generation_job")
    .select("id, demand_id, status, prompt_draft, prompt_edited")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Arte não encontrada" }, { status: 404 });
  if (!REGENERABLE.includes(job.status as string)) {
    return NextResponse.json(
      { error: "Esta arte já está sendo gerada" },
      { status: 409 }
    );
  }

  const incoming = body.prompt?.trim();
  const draft = (job.prompt_draft as string | null)?.trim() ?? "";

  if (incoming !== undefined && !incoming) {
    return NextResponse.json({ error: "O prompt não pode ficar vazio" }, { status: 400 });
  }
  if (incoming === undefined && !draft && !(job.prompt_edited as string | null)) {
    return NextResponse.json(
      { error: "Esta arte ainda não tem prompt — gere os criativos primeiro" },
      { status: 422 }
    );
  }

  const update: Database["public"]["Tables"]["art_generation_job"]["Update"] = {
    status: "queued",
    error: null,
    updated_at: new Date().toISOString(),
    // Voltar ao texto original limpa a edição — é o que a métrica de aprovação
    // sem edição mede (ver services/art-director.ts).
    ...(incoming !== undefined
      ? { prompt_edited: incoming === draft ? null : incoming }
      : {}),
  };

  const { error } = await supabase
    .from("art_generation_job")
    .update(update)
    .eq("id", jobId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  after(() =>
    runWorker({ jobId }).catch((err) => {
      console.error("[art-gen/regenerate]", (err as Error)?.message ?? err);
    })
  );

  return NextResponse.json({ ok: true });
}
