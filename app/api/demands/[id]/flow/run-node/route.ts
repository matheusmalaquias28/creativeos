import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import { flowJobParamsToRow } from "@/lib/flow/extract-flow-jobs";
import { extractNodeJob } from "@/lib/flow/node-job";

// Cobre o worker de geração (rodado via after() abaixo) — as gerações do lote
// rodam em paralelo, cada uma com seu timeout (IMAGE_JOB_TIMEOUT_MS em
// lib/ai/imagegen/worker.ts), mas isso só funciona se a função em si não for
// encerrada antes disso.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

type RunNodeBody = {
  artIndex: number;
};

export async function POST(req: Request, { params }: Params) {
  const { id: demandId } = await params;

  let body: RunNodeBody;
  try {
    body = (await req.json()) as RunNodeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.artIndex !== "number") {
    return NextResponse.json({ error: "artIndex é obrigatório" }, { status: 400 });
  }

  const result = await extractNodeJob(demandId, body.artIndex);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { demand, job } = result;

  const supabase = createAdminClient();

  // Reaproveita o MESMO job (mesma linha, mesmo id) ao regerar — nunca cria um
  // job novo pra essa art_index. art_version referencia job_id: um job novo
  // a cada clique em "Gerar" deixava a pilha de versões anteriores órfã (a UI
  // só lê versions do job atual), como se as artes já geradas tivessem sido
  // perdidas. Reusar o id mantém a pilha completa (v1, v2, …) sempre visível.
  const { data: existingJob } = await supabase
    .from("art_generation_job")
    .select("id")
    .eq("demand_id", demandId)
    .eq("art_index", body.artIndex)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = existingJob
    ? await supabase
        .from("art_generation_job")
        .update({
          status: "queued",
          error: null,
          ephemeral: true,
          params: flowJobParamsToRow(job),
        })
        .eq("id", existingJob.id)
    : await supabase.from("art_generation_job").insert({
        demand_id: demandId,
        client_id: demand.client_id,
        art_index: job.art_index,
        status: "queued",
        ephemeral: true,
        params: flowJobParamsToRow(job),
      });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  after(() =>
    runWorker(demandId).catch((err: unknown) => {
      console.error("[flow/run-node] worker error:", err instanceof Error ? err.message : err);
    })
  );

  return NextResponse.json({ ok: true, artIndex: job.art_index });
}
