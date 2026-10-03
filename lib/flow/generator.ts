import type { FlowGraph, FlowNode, FlowEdge } from './types';
import type { CreativeDemand } from '@/types/demand';
import { IMAGE_GEN_DEFAULTS } from '@/lib/ai/imagegen/defaults';

const COL_W = 280;
export const ROW_H = 200;

// Padrão do "Space" por demanda: feed 4:5 medium 2K. (Não mexe no
// IMAGE_GEN_DEFAULTS global — outros caminhos ainda usam 3:4.)
const FEED_ASPECT = "4:5";
const FEED_QUALITY = "medium" as const;
const STORY_ASPECT = "9:16";
// Instrução de reenquadramento (espelha STORY_ADAPT_PROMPT de lib/ai/imagegen/
// story.ts — inline aqui para o generator não puxar o provider/sharp pro client).
const STORY_PROMPT = "Adapte essas artes para o formato stories 9:16, sem adicionar textos e distorcer imagens";

/** Dados do node unificado `arte` (feed) — prompt + controles + saída. */
function feedArteData(
  demanda: Pick<CreativeDemand, "id" | "client_id" | "artes" | "briefing">,
  i: number
): import("./types").ArteData {
  const arte = demanda.artes[i];
  return {
    artIndex: i,
    label: `Arte ${i + 1}`,
    format: "feed",
    headline: arte?.headline ?? null,
    subheadline: arte?.subheadline ?? null,
    cta: arte?.cta ?? null,
    informacoesExtras: arte?.informacoesExtras ?? null,
    aspectRatio: FEED_ASPECT,
    imageSize: IMAGE_GEN_DEFAULTS.imageSize,
    model: IMAGE_GEN_DEFAULTS.model,
    quality: FEED_QUALITY,
    count: 1,
    demandId: demanda.id,
    clientId: demanda.client_id ?? "",
    briefingTitulo: demanda.briefing?.titulo ?? null,
    briefingTipo: demanda.briefing?.tipo ?? null,
  };
}

/**
 * Anexa o bloco de Stories ao grafo: Lista(modo list) ← todas as saídas feed →
 * node stories 9:16 → saída "story". A geração de stories em si é feita pelo
 * worker de 2 fases (runStoryWorker), disparado após o feed; a saída "story"
 * acumula 1 story por arte (pilha).
 */
function appendStoriesBlock(
  nodes: FlowNode[],
  edges: FlowEdge[],
  feedArteIds: string[],
  ids: { lista: string; arte: string },
  demanda: Pick<CreativeDemand, "id" | "client_id" | "briefing">,
  storyArtIndex: number,
  yTop: number
): void {
  if (feedArteIds.length === 0) return;

  nodes.push({
    id: ids.lista,
    type: "listaImagens",
    data: { label: "Feed", mode: "list" },
    position: { x: COL_W * 3, y: yTop },
  });
  nodes.push({
    id: ids.arte,
    type: "arte",
    data: {
      artIndex: storyArtIndex,
      label: "Stories",
      format: "story",
      promptText: STORY_PROMPT,
      aspectRatio: STORY_ASPECT,
      imageSize: IMAGE_GEN_DEFAULTS.imageSize,
      model: IMAGE_GEN_DEFAULTS.model,
      quality: FEED_QUALITY,
      count: 1,
      demandId: demanda.id,
      clientId: demanda.client_id ?? "",
    },
    position: { x: COL_W * 4, y: yTop },
  });

  // Cada node de feed alimenta a Lista; a Lista (modo list) alimenta o node de stories.
  for (const arteId of feedArteIds) {
    edges.push({ id: `e-${arteId}-${ids.lista}`, source: arteId, target: ids.lista });
  }
  edges.push({ id: `e-${ids.lista}-${ids.arte}`, source: ids.lista, target: ids.arte, targetHandle: "refs" });
}


/**
 * Gera um FlowGraph padrão para uma demanda com `numArtes` artes.
 *
 * Layout:
 *   clienteLogo  ──────────────────────────┐
 *                                           ├→ gerarImagem_0 → saidaArte_0
 *   clienteReferencias → promptArte_0 ─────┘
 *                           ↑ (seq edge de gerar_0)
 *                        promptArte_1 ─────→ gerarImagem_1 → saidaArte_1
 *                           ...
 *
 * Edge de sequência: gerar_{i-1} → prompt_{i}
 * Garante que @img{i} em prompt_{i} já esteja disponível quando o nó executa.
 */
export function gerarFluxoDaDemanda(
  demanda: Pick<CreativeDemand, 'id' | 'client_id' | 'artes' | 'briefing'>,
  numArtes: number
): FlowGraph {
  const clientId = demanda.client_id ?? '';
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const logoId = 'logo';
  const refsId = 'refs';

  nodes.push({
    id: logoId,
    type: 'clienteLogo',
    data: { clientId },
    position: { x: 0, y: 0 },
  });

  nodes.push({
    id: refsId,
    type: 'clienteReferencias',
    data: { clientId },
    position: { x: 0, y: 120 },
  });

  for (let i = 0; i < numArtes; i++) {
    const y = i * ROW_H;
    const arteId = `arte_${i}`;

    nodes.push({
      id: arteId,
      type: 'arte',
      data: feedArteData(demanda, i),
      position: { x: COL_W, y },
    });

    // Logo e refs entram direto no node unificado.
    edges.push({ id: `e-logo-${arteId}`, source: logoId, target: arteId, targetHandle: 'logo' });
    edges.push({ id: `e-refs-${arteId}`, source: refsId, target: arteId, targetHandle: 'refs' });
  }

  const feedArteIds = Array.from({ length: numArtes }, (_, i) => `arte_${i}`);
  appendStoriesBlock(
    nodes,
    edges,
    feedArteIds,
    { lista: "lista_stories", arte: "arte_stories" },
    demanda,
    numArtes,
    0
  );

  return { nodes, edges };
}

/**
 * Gera o bloco de nós/edges de UMA demanda, namespaced pelo demandId, pra ser
 * anexado a um client_flow_graph compartilhado — não cria clienteLogo/clienteReferencias
 * (usa os já existentes, passados via opts.logoId/opts.refsId).
 */
export function gerarSubfluxoDaDemanda(
  demanda: Pick<CreativeDemand, 'id' | 'client_id' | 'artes' | 'briefing'>,
  numArtes: number,
  opts: { logoId: string; refsId: string; yOffset: number }
): FlowGraph {
  const { logoId, refsId, yOffset } = opts;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  for (let i = 0; i < numArtes; i++) {
    const y = yOffset + i * ROW_H;
    const arteId = `arte_${demanda.id}_${i}`;

    nodes.push({
      id: arteId,
      type: 'arte',
      data: { ...feedArteData(demanda, i), demandId: demanda.id },
      position: { x: COL_W, y },
    });

    edges.push({ id: `e-logo-${arteId}`, source: logoId, target: arteId, targetHandle: 'logo' });
    edges.push({ id: `e-refs-${arteId}`, source: refsId, target: arteId, targetHandle: 'refs' });
  }

  const feedArteIds = Array.from({ length: numArtes }, (_, i) => `arte_${demanda.id}_${i}`);
  appendStoriesBlock(
    nodes,
    edges,
    feedArteIds,
    { lista: `lista_stories_${demanda.id}`, arte: `arte_stories_${demanda.id}` },
    demanda,
    numArtes,
    yOffset
  );

  return { nodes, edges };
}

function maxContentY(graph: FlowGraph): number {
  return graph.nodes.reduce((max, n) => {
    if (n.type === 'clienteLogo' || n.type === 'clienteReferencias') return max;
    return Math.max(max, n.position.y);
  }, -ROW_H);
}

/**
 * Funde a demanda no client_flow_graph compartilhado: se o cliente ainda não tem
 * fluxo, cria um novo (com logo/refs); se já tem mas essa demanda ainda não está
 * nele, anexa o bloco dela abaixo do conteúdo existente, reaproveitando o MESMO
 * logo/refs; se a demanda já está presente, retorna o grafo sem alterações.
 */
export function mergeDemandIntoClientGraph(
  clientGraph: FlowGraph | null,
  demanda: Pick<CreativeDemand, 'id' | 'client_id' | 'artes' | 'briefing'>,
  numArtes: number
): FlowGraph {
  const alreadyPresent = clientGraph?.nodes.some(
    (n) => n.type === 'arte' && n.data.demandId === demanda.id
  );
  if (clientGraph && alreadyPresent) return clientGraph;

  const base: FlowGraph = clientGraph ?? { nodes: [], edges: [] };

  let logoId = base.nodes.find((n) => n.type === 'clienteLogo')?.id;
  let refsId = base.nodes.find((n) => n.type === 'clienteReferencias')?.id;

  const sharedNodes: FlowNode[] = [];
  if (!logoId) {
    logoId = 'logo';
    sharedNodes.push({
      id: logoId,
      type: 'clienteLogo',
      data: { clientId: demanda.client_id ?? '' },
      position: { x: 0, y: 0 },
    });
  }
  if (!refsId) {
    refsId = 'refs';
    sharedNodes.push({
      id: refsId,
      type: 'clienteReferencias',
      data: { clientId: demanda.client_id ?? '' },
      position: { x: 0, y: 120 },
    });
  }

  const yOffset = clientGraph ? maxContentY(base) + ROW_H : 0;
  const subGraph = gerarSubfluxoDaDemanda(demanda, numArtes, { logoId, refsId, yOffset });

  return {
    nodes: [...base.nodes, ...sharedNodes, ...subGraph.nodes],
    edges: [...base.edges, ...subGraph.edges],
  };
}
