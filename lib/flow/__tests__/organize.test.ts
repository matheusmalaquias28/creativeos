import { describe, expect, it } from "vitest";
import { gerarFluxoDaDemanda, mergeDemandIntoClientGraph } from "@/lib/flow/generator";
import { demandFrames, demandOwnership, estimatedSize, organizeFlowGraph } from "@/lib/flow/organize";
import type { CreativeDemand } from "@/types/demand";
import type { FlowGraph } from "@/lib/flow/types";

type Demanda = Pick<CreativeDemand, "id" | "client_id" | "artes" | "briefing">;

const demanda = (id: string, titulo: string, n: number): Demanda =>
  ({
    id,
    client_id: "client-1",
    briefing: { titulo, tipo: "Feed" },
    artes: Array.from({ length: n }, () => ({ headline: "H", subheadline: null, cta: null, informacoesExtras: null })),
  }) as unknown as Demanda;

function twoDemands(): FlowGraph {
  const a = demanda("dem-a", "Campanha A", 2);
  const b = demanda("dem-b", "Campanha B", 3);
  return mergeDemandIntoClientGraph(mergeDemandIntoClientGraph(null, a, 2), b, 3);
}

function box(graph: FlowGraph, id: string) {
  const n = graph.nodes.find((x) => x.id === id)!;
  const s = estimatedSize(n);
  return { x0: n.position.x, y0: n.position.y, x1: n.position.x + s.w, y1: n.position.y + s.h };
}

describe("organizeFlowGraph", () => {
  it("atribui cada node à sua demanda; logo/refs do cliente ficam sem dono", () => {
    const owner = demandOwnership(twoDemands());
    expect(owner.get("arte_dem-a_0")).toBe("dem-a");
    expect(owner.get("lista_stories_dem-b")).toBe("dem-b");
    expect(owner.has("logo")).toBe(false);
    expect(owner.has("refs")).toBe(false);
  });

  it("cada demanda numa faixa própria, sem sobreposição", () => {
    const graph = organizeFlowGraph(twoDemands());
    const owner = demandOwnership(graph);
    const nodes = graph.nodes.map((n) => ({ id: n.id, ...box(graph, n.id) }));
    for (const a of nodes) {
      for (const b of nodes) {
        if (a.id >= b.id) continue;
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(overlap, `${a.id} × ${b.id}`).toBe(false);
      }
    }
    const bottomA = Math.max(...nodes.filter((n) => owner.get(n.id) === "dem-a").map((n) => n.y1));
    const topB = Math.min(...nodes.filter((n) => owner.get(n.id) === "dem-b").map((n) => n.y0));
    expect(topB).toBeGreaterThan(bottomA);
  });

  it("material do cliente fica à esquerda de todas as faixas", () => {
    const graph = organizeFlowGraph(twoDemands());
    const minDemandX = Math.min(
      ...graph.nodes.filter((n) => n.type !== "clienteLogo" && n.type !== "clienteReferencias").map((n) => n.position.x)
    );
    expect(box(graph, "logo").x1).toBeLessThan(minDemandX);
    expect(box(graph, "refs").x1).toBeLessThan(minDemandX);
  });

  it("molduras por demanda com título e sem se cruzarem", () => {
    const frames = demandFrames(organizeFlowGraph(twoDemands()));
    expect(frames.map((f) => f.title).sort()).toEqual(["Campanha A", "Campanha B"]);
    const [a, b] = [...frames].sort((x, y) => x.y - y.y);
    expect(b.y).toBeGreaterThan(a.y + a.h);
  });

  it("grafo de uma demanda só também organiza sem perder nodes", () => {
    const graph = gerarFluxoDaDemanda(demanda("dem-a", "A", 2), 2);
    expect(organizeFlowGraph(graph).nodes).toHaveLength(graph.nodes.length);
  });
});
