import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWorker } from "@/lib/ai/imagegen/worker";
import { extractFlowJobParams } from "@/lib/flow/extract-flow-jobs";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { getClientFlowGraph } from "@/services/flow";
import type { FlowGraph } from "@/lib/flow/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id: demandId } = await params;
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

  let profile: { logo_url: string | null; style_reference_urls: string[] | null } | null =
    null;
  if (demand.client_id) {
    const { data } = await supabase
      .from("client_creative_profile")
      .select("logo_url, style_reference_urls")
      .eq("client_id", demand.client_id)
      .maybeSingle();
    profile = data;
  }

  const enrichedGraph = enrichFlowGraphWithProfile(graph, profile);
  const briefing = (demand.briefing as { titulo?: string; tipo?: string }) ?? {};
  // Filtra por demandId — sem isso, um fluxo compartilhado por cliente reprocessaria
  // as artes de TODAS as demandas do cliente ao clicar "Executar" numa só.
  const jobParams = extractFlowJobParams(enrichedGraph, briefing, { demandId });

  if (jobParams.length === 0) {
    return NextResponse.json(
      { error: "Nenhum nó saidaArte encontrado no fluxo" },
      { status: 400 }
    );
  }

  await supabase
    .from("art_generation_job")
    .delete()
    .eq("demand_id", demandId)
    .in("status", ["queued", "failed"]);

  const rows = jobParams.map((p) => ({
    demand_id: demandId,
    client_id: demand.client_id,
    art_index: p.art_index,
    status: "queued" as const,
    params: {
      headline: p.headline,
      subheadline: p.subheadline,
      cta: p.cta,
      informacoesExtras: p.informacoesExtras,
      aspect_ratio: p.aspect_ratio,
      image_size: p.image_size,
      model: p.model,
      quality: p.quality,
      briefing_titulo: p.briefing_titulo,
      briefing_tipo: p.briefing_tipo,
      flow_logo_url: p.flow_logo_url,
      flow_references: p.flow_references,
    },
  }));

  const { error: insertError } = await supabase
    .from("art_generation_job")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  void runWorker(demandId).catch((err: unknown) => {
    console.error("[flow/run] worker error:", err instanceof Error ? err.message : err);
  });

  return NextResponse.json({ ok: true, jobsCreated: rows.length });
}
