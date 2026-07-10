import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import { extractFlowJobParams } from "@/lib/flow/extract-flow-jobs";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { loadFlowCreativeProfile } from "@/lib/flow/load-creative-profile";
import { getClientFlowGraph } from "@/services/flow";
import type { FlowGraph } from "@/lib/flow/types";

// Cobre o worker de geração (rodado via after() abaixo) — cada job tem seu próprio
// timeout de 2min (IMAGE_JOB_TIMEOUT_MS em lib/ai/imagegen/worker.ts), mas isso só
// funciona se a função em si não for encerrada antes disso.
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

  const supabase = createAdminClient();

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_id, briefing, flow_graph")
    .eq("id", demandId)
    .single();

  if (demandError || !demand) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }

  const graph = demand.client_id
    ? await getClientFlowGraph(demand.client_id)
    : ((demand.flow_graph as FlowGraph | null) ?? null);

  if (!graph || !graph.nodes?.length) {
    return NextResponse.json(
      { error: "Nenhum fluxo salvo — salve o fluxo antes de executar" },
      { status: 400 }
    );
  }

  const profile = await loadFlowCreativeProfile(demand.client_id ?? null);

  const enrichedGraph = enrichFlowGraphWithProfile(graph, profile);
  const briefing = (demand.briefing as { titulo?: string; tipo?: string }) ?? {};
  const job = extractFlowJobParams(enrichedGraph, briefing, { demandId }).find(
    (entry) => entry.art_index === body.artIndex
  );

  if (!job) {
    return NextResponse.json(
      { error: "Pipeline da arte não encontrado no fluxo salvo" },
      { status: 404 }
    );
  }

  await supabase
    .from("art_generation_job")
    .delete()
    .eq("demand_id", demandId)
    .eq("art_index", body.artIndex)
    .in("status", ["queued", "failed"]);

  const { error } = await supabase.from("art_generation_job").insert({
    demand_id: demandId,
    client_id: demand.client_id,
    art_index: job.art_index,
    status: "queued",
    params: {
      headline: job.headline,
      subheadline: job.subheadline,
      cta: job.cta,
      informacoesExtras: job.informacoesExtras,
      aspect_ratio: job.aspect_ratio,
      image_size: job.image_size,
      model: job.model,
      quality: job.quality,
      briefing_titulo: job.briefing_titulo,
      briefing_tipo: job.briefing_tipo,
      flow_logo_url: job.flow_logo_url,
      flow_references: job.flow_references,
    },
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
