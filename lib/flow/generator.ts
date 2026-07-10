import type { FlowGraph, FlowNode, FlowEdge } from './types';
import type { CreativeDemand } from '@/types/demand';

const COL_W = 280;
export const ROW_H = 200;

// Defaults novos de gerarImagem — Magnific gpt-2 (ver lib/magnific/generate-art.ts).
const DEFAULT_MODEL = 'gpt-2';
const DEFAULT_QUALITY = 'low' as const;
const DEFAULT_ASPECT_RATIO = '3:4';
const DEFAULT_IMAGE_SIZE = '2K';


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
    const arte = demanda.artes[i];
    const y = i * ROW_H;

    const promptId = `prompt_${i}`;
    const gerarId = `gerar_${i}`;
    const saidaId = `saida_${i}`;

    nodes.push({
      id: promptId,
      type: 'promptArte',
      data: {
        artIndex: i,
        headline: arte?.headline ?? null,
        subheadline: arte?.subheadline ?? null,
        cta: arte?.cta ?? null,
        informacoesExtras: arte?.informacoesExtras ?? null,
      },
      position: { x: COL_W, y },
    });

    nodes.push({
      id: gerarId,
      type: 'gerarImagem',
      data: {
        aspectRatio: DEFAULT_ASPECT_RATIO,
        imageSize: DEFAULT_IMAGE_SIZE,
        model: DEFAULT_MODEL,
        quality: DEFAULT_QUALITY,
        demandId: demanda.id,
        clientId: demanda.client_id ?? '',
        briefingTitulo: demanda.briefing?.titulo ?? null,
        briefingTipo: demanda.briefing?.tipo ?? null,
      },
      position: { x: COL_W * 2, y },
    });

    nodes.push({
      id: saidaId,
      type: 'saidaArte',
      data: { artIndex: i, label: `Arte ${i + 1}` },
      position: { x: COL_W * 3, y },
    });

    // Logo e refs entram em gerarImagem
    edges.push({ id: `e-logo-${gerarId}`, source: logoId, target: gerarId, targetHandle: 'logo' });
    edges.push({ id: `e-refs-${gerarId}`, source: refsId, target: gerarId, targetHandle: 'refs' });

    // Prompt → gerarImagem
    edges.push({ id: `e-${promptId}-${gerarId}`, source: promptId, target: gerarId, targetHandle: 'prompt' });

    // gerarImagem → saidaArte
    edges.push({ id: `e-${gerarId}-${saidaId}`, source: gerarId, target: saidaId });
    // Nota: sem edges entre artes distintas no fluxo padrão.
    // Para usar @imgN em promptArte_i, conecte manualmente gerar_{i-1} → prompt_i.
  }

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
    const arte = demanda.artes[i];
    const y = yOffset + i * ROW_H;

    const promptId = `prompt_${demanda.id}_${i}`;
    const gerarId = `gerar_${demanda.id}_${i}`;
    const saidaId = `saida_${demanda.id}_${i}`;

    nodes.push({
      id: promptId,
      type: 'promptArte',
      data: {
        artIndex: i,
        headline: arte?.headline ?? null,
        subheadline: arte?.subheadline ?? null,
        cta: arte?.cta ?? null,
        informacoesExtras: arte?.informacoesExtras ?? null,
      },
      position: { x: COL_W, y },
    });

    nodes.push({
      id: gerarId,
      type: 'gerarImagem',
      data: {
        aspectRatio: DEFAULT_ASPECT_RATIO,
        imageSize: DEFAULT_IMAGE_SIZE,
        model: DEFAULT_MODEL,
        quality: DEFAULT_QUALITY,
        demandId: demanda.id,
        clientId: demanda.client_id ?? '',
        briefingTitulo: demanda.briefing?.titulo ?? null,
        briefingTipo: demanda.briefing?.tipo ?? null,
      },
      position: { x: COL_W * 2, y },
    });

    nodes.push({
      id: saidaId,
      type: 'saidaArte',
      data: { artIndex: i, label: `Arte ${i + 1}`, demandId: demanda.id },
      position: { x: COL_W * 3, y },
    });

    edges.push({ id: `e-logo-${gerarId}`, source: logoId, target: gerarId, targetHandle: 'logo' });
    edges.push({ id: `e-refs-${gerarId}`, source: refsId, target: gerarId, targetHandle: 'refs' });
    edges.push({ id: `e-${promptId}-${gerarId}`, source: promptId, target: gerarId, targetHandle: 'prompt' });
    edges.push({ id: `e-${gerarId}-${saidaId}`, source: gerarId, target: saidaId });

    // Logo/refs também linkados ao node de texto — habilita @(logo) no promptArte.
    edges.push({ id: `e-logo-${promptId}`, source: logoId, target: promptId });
    edges.push({ id: `e-refs-${promptId}`, source: refsId, target: promptId });
  }

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
    (n) => n.type === 'gerarImagem' && n.data.demandId === demanda.id
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
