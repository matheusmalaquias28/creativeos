import { createAdminClient } from "@/lib/supabase/admin";
import { gerarFluxoDaDemanda, mergeDemandIntoClientGraph } from "@/lib/flow/generator";
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
    (n): n is FlowNode & { type: "gerarImagem" } =>
      n.type === "gerarImagem" && n.data.demandId === demandId
  );
}

/**
 * Fonte principal do grafo do fluxo pra uma demanda. Sem client_id vinculado, cai
 * no fallback legado (flow_graph por demanda). Com client_id, busca/cria/funde o
 * grafo compartilhado do cliente — a única escrita-durante-leitura desse fluxo
 * (criar/fundir na primeira visita de cada demanda ao canvas).
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
    return { graph: existing ?? gerarFluxoDaDemanda(demand, numArtes), clientId: null };
  }

  const existingGraph = await getClientFlowGraph(demand.client_id);

  if (existingGraph && hasDemandNodes(existingGraph, demand.id)) {
    return { graph: existingGraph, clientId: demand.client_id };
  }

  const merged = mergeDemandIntoClientGraph(existingGraph, demand, numArtes);
  await upsertClientFlowGraph(demand.client_id, merged);
  return { graph: merged, clientId: demand.client_id };
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
