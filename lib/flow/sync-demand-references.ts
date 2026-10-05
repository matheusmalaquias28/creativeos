import { CATEGORY_META, isReferenceCategory } from "@/lib/image-library/categories";
import { upsertMentionLine } from "@/lib/flow/mention-text";
import { getPromptArteEditorText } from "@/lib/flow/prompt-arte-text";
import type { ArteData, FlowEdge, FlowGraph, FlowNode, ReferenciaImagemData } from "@/lib/flow/types";

export type DemandReferenceRow = {
  id: string;
  storage_url: string;
  role: string | null;
  category: string | null;
  /** null = vale pra todas as artes da demanda; senão, só a arte desse índice (0-based). */
  arte_index: number | null;
  position: number;
};

function normalizeKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

function uniqueLabel(base: string, taken: Set<string>): string {
  let label = base;
  for (let i = 2; taken.has(label.toLowerCase()); i++) label = `${base} ${i}`;
  taken.add(label.toLowerCase());
  return label;
}

/** Labels já usados pelas referências hoje conectadas a um node `arte` (pra não colidir). */
function connectedRefLabels(graph: FlowGraph, arteNodeId: string): Set<string> {
  const labels = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.target !== arteNodeId) continue;
    const src = graph.nodes.find((n) => n.id === edge.source);
    if (src?.type === "referenciaImagem") {
      const label = (src.data as ReferenciaImagemData).label;
      if (label) labels.add(label.toLowerCase());
    }
  }
  return labels;
}

/**
 * Materializa toda referência cadastrada na PÁGINA da demanda (fora do Space,
 * tabela `demand_reference_image`) como um node `referenciaImagem` visível e
 * conectado no canvas — e cola a instrução de uso no texto do prompt da(s)
 * arte(s) alvo, igual ao fluxo nativo do Space (ver addLibraryReference em
 * arte-node.tsx). Sem isso, a referência direcionava a geração sem aparecer
 * em lugar nenhum no Space, o que viola "tudo que for direcionamento de arte
 * tem que estar visível no Space".
 *
 * Idempotente: cada row vira um node com id estável (`referenciaImagem-dbref-
 * <row.id>`) — rodar de novo sobre um grafo já sincronizado não duplica nada.
 */
export function syncDemandReferencesIntoGraph(
  graph: FlowGraph,
  demandId: string,
  rows: DemandReferenceRow[]
): FlowGraph {
  if (rows.length === 0) return graph;

  const existingIds = new Set(graph.nodes.map((n) => n.id));
  const arteNodes = graph.nodes.filter(
    (n): n is FlowNode & { type: "arte"; data: ArteData } =>
      n.type === "arte" && n.data.demandId === demandId
  );
  if (arteNodes.length === 0) return graph;

  const newNodes: FlowNode[] = [];
  const newEdges: FlowEdge[] = [];
  const takenLabelsByArte = new Map<string, Set<string>>();
  const promptPatches = new Map<string, string>(); // arteNodeId -> novo promptText
  const stackOffset = new Map<string, number>(); // arteNodeId -> quantas refs novas já empilhadas

  const takenFor = (arteId: string): Set<string> => {
    let set = takenLabelsByArte.get(arteId);
    if (!set) {
      set = connectedRefLabels(graph, arteId);
      takenLabelsByArte.set(arteId, set);
    }
    return set;
  };

  for (const row of rows) {
    const nodeId = `referenciaImagem-dbref-${row.id}`;
    if (existingIds.has(nodeId)) continue;
    if (!row.storage_url?.trim()) continue;

    const targets =
      row.arte_index === null
        ? arteNodes
        : arteNodes.filter((n) => n.data.artIndex === row.arte_index);
    if (targets.length === 0) continue;

    const category = isReferenceCategory(row.category) ? row.category : null;
    const baseLabel = category ? CATEGORY_META[category].mentionName : row.role?.trim() || "Referência";
    const instruction = category ? CATEGORY_META[category].instruction : row.role?.trim() || null;

    // Label único em relação ao PRIMEIRO alvo (a menção é a mesma em todos os
    // alvos quando a referência é compartilhada por todas as artes).
    const label = uniqueLabel(baseLabel, takenFor(targets[0].id));
    const token = normalizeKey(label);

    const anchor = targets[0];
    const n = (stackOffset.get(anchor.id) ?? 0) + 1;
    stackOffset.set(anchor.id, n);

    newNodes.push({
      id: nodeId,
      type: "referenciaImagem",
      position: { x: anchor.position.x - 260, y: anchor.position.y + n * 90 },
      data: {
        imageUrl: row.storage_url,
        label,
        category: category ?? undefined,
        intent: instruction ? `${label}: ${instruction}` : undefined,
      } satisfies ReferenciaImagemData,
    });

    for (const target of targets) {
      newEdges.push({
        id: `e-${nodeId}-${target.id}`,
        source: nodeId,
        target: target.id,
        targetHandle: "refs",
      });
      if (!instruction) continue;

      const currentText = promptPatches.get(target.id) ?? getPromptArteEditorText(target.data);
      promptPatches.set(target.id, upsertMentionLine(currentText, token, instruction));
    }
  }

  if (newNodes.length === 0) return graph;

  const patchedNodes = graph.nodes.map((n) => {
    const patch = promptPatches.get(n.id);
    if (!patch || n.type !== "arte") return n;
    return { ...n, data: { ...n.data, promptText: patch } };
  });

  return {
    nodes: [...patchedNodes, ...newNodes],
    edges: [...graph.edges, ...newEdges],
  };
}
