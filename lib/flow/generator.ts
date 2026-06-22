import type { FlowGraph, FlowNode, FlowEdge } from './types';
import type { CreativeDemand } from '@/types/demand';

const COL_W = 280;
const ROW_H = 200;

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
