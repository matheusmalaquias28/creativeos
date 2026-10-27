import type { FlowGraph, FlowNode } from "./types";

/**
 * Organização do Space compartilhado do cliente: cada demanda vira uma FAIXA
 * horizontal própria (uma abaixo da outra) e o material fixo do cliente
 * (logo/refs) fica numa coluna à esquerda de todas. Isomórfico — usado no
 * servidor (ao fundir demanda nova) e no canvas (botão Organizar, molduras).
 */

export type NodeSize = { w: number; h: number };
export type SizeOf = (node: FlowNode) => NodeSize;

/** Tamanho estimado quando o node ainda não foi medido no navegador. */
export function estimatedSize(node: FlowNode): NodeSize {
  switch (node.type) {
    case "arte":
      return node.data.format === "story" ? { w: 320, h: 720 } : { w: 320, h: 560 };
    case "clienteLogo":
      return { w: 160, h: 180 };
    case "clienteReferencias":
      return { w: 240, h: 300 };
    case "referenciaImagem":
      return { w: 160, h: 200 };
    case "listaImagens":
      return { w: 288, h: 320 };
    default:
      return { w: 240, h: 200 };
  }
}

const SHARED_TYPES = new Set(["clienteLogo", "clienteReferencias"]);

/** Espaço reservado acima de cada faixa para o título da demanda. */
export const BAND_HEADER = 72;
const BAND_GAP = 160;
const COL_GAP = 96;
const SIDE_GAP = 64;
const STACK_GAP = 28;
const SHARED_GAP = 200;

/**
 * Demanda dona de cada node: `arte` pelo demandId; os demais pelas artes que
 * alimentam (a jusante) ou, sem nenhuma, pelas artes de onde vêm (ex.: Lista
 * "Geradas"). Node usado por mais de uma demanda, ou solto, não tem dono.
 */
export function demandOwnership(graph: FlowGraph): Map<string, string> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const targets = new Map<string, string[]>();
  const sources = new Map<string, string[]>();
  for (const e of graph.edges) {
    targets.set(e.source, [...(targets.get(e.source) ?? []), e.target]);
    sources.set(e.target, [...(sources.get(e.target) ?? []), e.source]);
  }

  const walk = (start: string, next: Map<string, string[]>): Set<string> => {
    const found = new Set<string>();
    const seen = new Set<string>([start]);
    const queue = [...(next.get(start) ?? [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const n = byId.get(id);
      if (!n || SHARED_TYPES.has(n.type)) continue;
      if (n.type === "arte") {
        if (n.data.demandId) found.add(n.data.demandId);
        continue;
      }
      queue.push(...(next.get(id) ?? []));
    }
    return found;
  };

  const owner = new Map<string, string>();
  for (const n of graph.nodes) {
    if (SHARED_TYPES.has(n.type)) continue;
    if (n.type === "arte") {
      if (n.data.demandId) owner.set(n.id, n.data.demandId);
      continue;
    }
    let demands = walk(n.id, targets);
    if (demands.size === 0) demands = walk(n.id, sources);
    if (demands.size === 1) owner.set(n.id, [...demands][0]);
  }
  return owner;
}

/** Artes na ordem da faixa: feed por índice, stories por último. */
function arteOrder(a: FlowNode, b: FlowNode): number {
  const story = (n: FlowNode) => (n.type === "arte" && n.data.format === "story" ? 1 : 0);
  const idx = (n: FlowNode) => (n.type === "arte" ? n.data.artIndex : 0);
  return story(a) - story(b) || idx(a) - idx(b) || a.position.x - b.position.x;
}

/**
 * Reposiciona o grafo inteiro: coluna do cliente à esquerda; uma faixa por
 * demanda (na ordem vertical atual, então quem já estava em cima continua em
 * cima). Dentro da faixa, cada arte é uma coluna com suas entradas empilhadas
 * à esquerda e suas saídas (ex.: Lista "Geradas") à direita. Nodes soltos não
 * se mexem.
 */
export function organizeFlowGraph(graph: FlowGraph, sizeOf: SizeOf = estimatedSize): FlowGraph {
  const owner = demandOwnership(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const pos = new Map<string, { x: number; y: number }>();

  // Faixas na ordem vertical atual (menor y de cada demanda).
  const groups = new Map<string, FlowNode[]>();
  for (const n of graph.nodes) {
    const d = owner.get(n.id);
    if (d) groups.set(d, [...(groups.get(d) ?? []), n]);
  }
  const bandOrder = [...groups.entries()]
    .map(([d, ns]) => ({ d, ns, top: Math.min(...ns.map((n) => n.position.y)) }))
    .sort((a, b) => a.top - b.top);

  let bandTop = 0;
  for (const { ns } of bandOrder) {
    const members = new Set(ns.map((n) => n.id));
    const artes = ns.filter((n) => n.type === "arte").sort(arteOrder);
    const colOf = new Map(artes.map((a, i) => [a.id, i]));
    const inputs = artes.map((): FlowNode[] => []);
    const outputs = artes.map((): FlowNode[] => []);

    // Coluna de cada node não-arte: primeira arte que ele alimenta (direto ou
    // por uma cadeia de nodes da mesma faixa); sem nenhuma, vira saída da
    // primeira arte de onde vem.
    const reach = (start: string, forward: boolean): number | null => {
      let best: number | null = null;
      const seen = new Set<string>([start]);
      const queue = [start];
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const e of graph.edges) {
          const nextId = forward ? (e.source === id ? e.target : null) : e.target === id ? e.source : null;
          if (!nextId || seen.has(nextId) || !members.has(nextId)) continue;
          seen.add(nextId);
          const col = colOf.get(nextId);
          if (col !== undefined) best = best === null ? col : Math.min(best, col);
          else queue.push(nextId);
        }
      }
      return best;
    };

    const loose: FlowNode[] = [];
    for (const n of ns) {
      if (n.type === "arte") continue;
      const asInput = reach(n.id, true);
      if (asInput !== null) {
        inputs[asInput].push(n);
        continue;
      }
      const asOutput = reach(n.id, false);
      if (asOutput !== null) outputs[asOutput].push(n);
      else loose.push(n);
    }

    const stack = (list: FlowNode[], x: number, y: number): { w: number; h: number } => {
      let cy = y;
      let w = 0;
      for (const n of [...list].sort((a, b) => a.position.y - b.position.y)) {
        const s = sizeOf(n);
        pos.set(n.id, { x, y: cy });
        cy += s.h + STACK_GAP;
        w = Math.max(w, s.w);
      }
      return { w, h: list.length > 0 ? cy - y - STACK_GAP : 0 };
    };

    const contentTop = bandTop + BAND_HEADER;
    let x = 0;
    let bandH = 0;
    artes.forEach((arte, i) => {
      const inW = Math.max(0, ...inputs[i].map((n) => sizeOf(n).w));
      const inStack = stack(inputs[i], x, contentTop);
      const arteX = x + (inW > 0 ? inW + SIDE_GAP : 0);
      const arteSize = sizeOf(arte);
      pos.set(arte.id, { x: arteX, y: contentTop });
      let colEnd = arteX + arteSize.w;
      const outStack = stack(outputs[i], colEnd + SIDE_GAP, contentTop);
      if (outputs[i].length > 0) colEnd += SIDE_GAP + outStack.w;
      bandH = Math.max(bandH, inStack.h, arteSize.h, outStack.h);
      x = colEnd + COL_GAP;
    });
    // Nodes da demanda sem vínculo com nenhuma arte: no fim da faixa.
    for (const n of loose) {
      const s = sizeOf(n);
      pos.set(n.id, { x, y: contentTop });
      x += s.w + COL_GAP;
      bandH = Math.max(bandH, s.h);
    }

    bandTop = contentTop + bandH + BAND_GAP;
  }

  // Material do cliente: coluna à esquerda das faixas, alinhada com a primeira.
  const shared = graph.nodes.filter((n) => SHARED_TYPES.has(n.type));
  const sharedW = Math.max(0, ...shared.map((n) => sizeOf(n).w));
  const sharedX = -(sharedW + SHARED_GAP);
  let sy = BAND_HEADER;
  for (const n of [...shared].sort((a, b) => a.position.y - b.position.y)) {
    pos.set(n.id, { x: sharedX, y: sy });
    sy += sizeOf(n).h + STACK_GAP;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const p = pos.get(n.id);
      return p && byId.has(n.id) ? { ...n, position: p } : n;
    }),
  };
}

export type DemandFrame = {
  demandId: string;
  title: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
};

const FRAME_PAD = 32;

/** Moldura (bounding box + título) de cada demanda, a partir das posições atuais. */
export function demandFrames(graph: FlowGraph, sizeOf: SizeOf = estimatedSize): DemandFrame[] {
  const owner = demandOwnership(graph);
  const boxes = new Map<string, { x0: number; y0: number; x1: number; y1: number; title: string | null }>();
  for (const n of graph.nodes) {
    const d = owner.get(n.id);
    if (!d) continue;
    const s = sizeOf(n);
    const b = boxes.get(d) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, title: null };
    b.x0 = Math.min(b.x0, n.position.x);
    b.y0 = Math.min(b.y0, n.position.y);
    b.x1 = Math.max(b.x1, n.position.x + s.w);
    b.y1 = Math.max(b.y1, n.position.y + s.h);
    if (!b.title && n.type === "arte" && n.data.briefingTitulo) b.title = n.data.briefingTitulo;
    boxes.set(d, b);
  }
  return [...boxes.entries()].map(([demandId, b]) => ({
    demandId,
    title: b.title,
    x: b.x0 - FRAME_PAD,
    y: b.y0 - BAND_HEADER,
    w: b.x1 - b.x0 + FRAME_PAD * 2,
    h: b.y1 - b.y0 + BAND_HEADER + FRAME_PAD,
  }));
}

/** Fundo do conteúdo atual (nodes de demanda), pra anexar uma faixa nova abaixo. */
export function contentBottom(graph: FlowGraph, sizeOf: SizeOf = estimatedSize): number | null {
  const ys = graph.nodes
    .filter((n) => !SHARED_TYPES.has(n.type))
    .map((n) => n.position.y + sizeOf(n).h);
  return ys.length > 0 ? Math.max(...ys) : null;
}
