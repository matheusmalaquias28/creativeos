import { createAdminClient } from "@/lib/supabase/admin";
import { extractFlowJobParams, type FlowJobParams } from "@/lib/flow/extract-flow-jobs";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { loadFlowCreativeProfile } from "@/lib/flow/load-creative-profile";
import { getClientFlowGraph, syncAndPersistDemandReferences } from "@/services/flow";
import type { FlowGraph } from "@/lib/flow/types";

export type NodeJobResult =
  | { ok: true; demand: { id: string; client_id: string | null }; job: FlowJobParams }
  | { ok: false; status: number; error: string };

/**
 * Extrai do fluxo SALVO o job de um node arte (por artIndex) — o mesmo caminho
 * para gerar (run-node) e para o preview do que vai na geração (preview-node).
 */
export async function extractNodeJob(demandId: string, artIndex: number): Promise<NodeJobResult> {
  const supabase = createAdminClient();

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("id, client_id, briefing, flow_graph")
    .eq("id", demandId)
    .single();

  if (demandError || !demand) return { ok: false, status: 404, error: "Demanda não encontrada" };

  const savedGraph = demand.client_id
    ? await getClientFlowGraph(demand.client_id)
    : ((demand.flow_graph as FlowGraph | null) ?? null);

  if (!savedGraph || !savedGraph.nodes?.length) {
    return { ok: false, status: 400, error: "Nenhum fluxo salvo — salve o fluxo antes de executar" };
  }

  // Sincroniza referências cadastradas na página da demanda antes de gerar —
  // ver run/route.ts para o motivo.
  const graph = await syncAndPersistDemandReferences(demand, savedGraph);

  const profile = await loadFlowCreativeProfile(demand.client_id ?? null);
  const enrichedGraph = enrichFlowGraphWithProfile(graph, profile);
  const briefing = (demand.briefing as { titulo?: string; tipo?: string }) ?? {};
  const job = extractFlowJobParams(enrichedGraph, briefing, {
    demandId,
    includeStory: true,
  }).find((entry) => entry.art_index === artIndex);

  if (!job) return { ok: false, status: 404, error: "Pipeline da arte não encontrado no fluxo salvo" };

  return { ok: true, demand: { id: demand.id, client_id: demand.client_id }, job };
}
