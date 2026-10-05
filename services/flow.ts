import { createAdminClient } from "@/lib/supabase/admin";
import { gerarFluxoDaDemanda, mergeDemandIntoClientGraph } from "@/lib/flow/generator";
import { syncDemandReferencesIntoGraph, type DemandReferenceRow } from "@/lib/flow/sync-demand-references";
import type { FlowGraph, FlowNode } from "@/lib/flow/types";
import type { CreativeDemand } from "@/types/demand";

export type DemandForFlow = Pick<CreativeDemand, "id" | "client_id" | "artes" | "briefing">;

// Admin-scoped em ambos os casos: chamado tanto pela página (sessão de usuário)
// quanto por rotas de API sem sessão (run/run-node) — evita fricção de RLS.

export async function getClientFlowGraph(clientId: string): Promise<FlowGraph | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_flow_graph")
    .select("graph")
    .eq("client_id", clientId)
    .maybeSingle();

  return (data?.graph as FlowGraph | undefined) ?? null;
}

export async function upsertClientFlowGraph(clientId: string, graph: FlowGraph): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_flow_graph")
    .upsert({ client_id: clientId, graph }, { onConflict: "client_id" });

  if (error) throw new Error(error.message);
}

function hasDemandNodes(graph: FlowGraph, demandId: string): boolean {
  return graph.nodes.some(
    (n): n is FlowNode & { type: "arte" } =>
      n.type === "arte" && n.data.demandId === demandId
  );
}

/**
 * Referências cadastradas na PÁGINA da demanda (fora do Space). Carregadas a
 * cada visita ao canvas pra sincronizar com o grafo — ver syncDemandReferencesIntoGraph.
 */
async function loadDemandReferenceRows(demandId: string): Promise<DemandReferenceRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("demand_reference_image")
    .select("id, storage_url, role, category, arte_index, position")
    .eq("demand_id", demandId)
    .order("position", { ascending: true });
  return (data ?? []) as DemandReferenceRow[];
}

/**
 * Sincroniza referências da página da demanda num grafo JÁ CARREGADO
 * (persistindo se mudou algo) — usado pelas rotas run/run-node, que leem o
 * grafo salvo sem o fallback de criar/fundir (`getOrCreateClientFlowGraph` é
 * só pra carga de página). Sem isso, gerar via API logo após cadastrar uma
 * referência na página da demanda rodaria contra o grafo desatualizado.
 */
export async function syncAndPersistDemandReferences(
  demand: Pick<DemandForFlow, "id" | "client_id">,
  graph: FlowGraph
): Promise<FlowGraph> {
  const refRows = await loadDemandReferenceRows(demand.id);
  const synced = syncDemandReferencesIntoGraph(graph, demand.id, refRows);
  if (synced === graph) return graph;

  if (demand.client_id) {
    await upsertClientFlowGraph(demand.client_id, synced);
  } else {
    const supabase = createAdminClient();
    await supabase
      .from("creative_demands")
      .update({ flow_graph: synced, updated_at: new Date().toISOString() })
      .eq("id", demand.id);
  }
  return synced;
}

/**
 * Fonte principal do grafo do fluxo pra uma demanda. Sem client_id vinculado, cai
 * no fallback legado (flow_graph por demanda). Com client_id, busca/cria/funde o
 * grafo compartilhado do cliente — a única escrita-durante-leitura desse fluxo
 * (criar/fundir na primeira visita de cada demanda ao canvas).
 *
 * Em toda visita, também sincroniza as referências cadastradas na página da
 * demanda (fora do Space) como nodes visíveis — nunca pode existir um
 * direcionamento de geração que só existe escondido no banco.
 */
export async function getOrCreateClientFlowGraph(
  demand: DemandForFlow,
  numArtes: number
): Promise<{ graph: FlowGraph; clientId: string | null }> {
  if (!demand.client_id) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("creative_demands")
      .select("flow_graph")
      .eq("id", demand.id)
      .maybeSingle();

    const existing = (data?.flow_graph as FlowGraph | null) ?? null;
    const base = existing ?? gerarFluxoDaDemanda(demand, numArtes);
    const synced = await syncAndPersistDemandReferences(demand, base);
    return { graph: synced, clientId: null };
  }

  const existingGraph = await getClientFlowGraph(demand.client_id);

  const base =
    existingGraph && hasDemandNodes(existingGraph, demand.id)
      ? existingGraph
      : mergeDemandIntoClientGraph(existingGraph, demand, numArtes);

  if (base !== existingGraph) {
    await upsertClientFlowGraph(demand.client_id, base);
  }

  const synced = await syncAndPersistDemandReferences(demand, base);
  return { graph: synced, clientId: demand.client_id };
}

/**
 * Funde o flow_graph legado de uma demanda (acumulado enquanto sem cliente) no
 * grafo compartilhado do cliente, no momento em que ela é vinculada manualmente.
 * Não descarta o trabalho já feito na demanda sem cliente.
 */
export async function mergeLegacyDemandFlowIntoClient(
  demandId: string,
  clientId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("creative_demands")
    .select("flow_graph")
    .eq("id", demandId)
    .maybeSingle();

  const legacyGraph = (data?.flow_graph as FlowGraph | null) ?? null;
  if (!legacyGraph?.nodes?.length) return;

  const existingClientGraph = await getClientFlowGraph(clientId);
  if (existingClientGraph && hasDemandNodes(existingClientGraph, demandId)) return;

  // Nota: se o cliente já tiver um client_flow_graph próprio, o grafo legado (IDs
  // sem namespace, ex. "prompt_0") pode colidir com o dele — caso raro (exige que
  // a demanda tenha gerado um flow_graph legado E o cliente já tenha outro fluxo
  // antes do vínculo manual); aceito por ora, sem rename automático de IDs.
  const merged: FlowGraph = existingClientGraph
    ? { nodes: [...existingClientGraph.nodes, ...legacyGraph.nodes], edges: [...existingClientGraph.edges, ...legacyGraph.edges] }
    : legacyGraph;

  await upsertClientFlowGraph(clientId, merged);
}
