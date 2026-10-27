import { describe, expect, it } from "vitest";
import { gerarFluxoDaDemanda } from "@/lib/flow/generator";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { extractFlowJobParams } from "@/lib/flow/extract-flow-jobs";
import { syncDemandReferencesIntoGraph } from "@/lib/flow/sync-demand-references";
import { LEGACY_STORY_PROMPTS, STORY_PROMPT } from "@/lib/flow/story-defaults";
import type { CreativeDemand } from "@/types/demand";
import type { FlowGraph } from "@/lib/flow/types";

const demanda = {
  id: "demand-1",
  client_id: "client-1",
  briefing: { titulo: "Campanha", tipo: "Feed" },
  artes: [{ headline: "H", subheadline: null, cta: null, informacoesExtras: null }],
} as unknown as Pick<CreativeDemand, "id" | "client_id" | "artes" | "briefing">;

function storyNode(graph: FlowGraph) {
  const node = graph.nodes.find((n) => n.type === "arte" && n.data.format === "story");
  if (node?.type !== "arte") throw new Error("sem node de stories");
  return node;
}

describe("node de stories", () => {
  it("nasce com o prompt padrão novo e esforço low", () => {
    const node = storyNode(gerarFluxoDaDemanda(demanda, 1));
    expect(node.data.promptText).toBe(STORY_PROMPT);
    expect(node.data.quality).toBe("low");
  });

  it("enrich troca o texto padrão antigo e mantém o esforço escolhido; texto editado fica", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const node = storyNode(graph);
    node.data.promptText = LEGACY_STORY_PROMPTS[0];
    node.data.quality = "high";
    expect(storyNode(enrichFlowGraphWithProfile(graph, null)).data).toMatchObject({
      promptText: STORY_PROMPT,
      quality: "high",
    });

    node.data.quality = undefined;
    expect(storyNode(enrichFlowGraphWithProfile(graph, null)).data.quality).toBe("low");

    node.data.promptText = "Meu texto de stories";
    expect(storyNode(enrichFlowGraphWithProfile(graph, null)).data.promptText).toBe(
      "Meu texto de stories"
    );
  });

  it("job de stories sai low por padrão e respeita o esforço escolhido", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const storyJob = () =>
      extractFlowJobParams(graph, demanda.briefing, { includeStory: true }).find((j) => j.skip_logo);
    storyNode(graph).data.quality = undefined;
    expect(storyJob()?.quality).toBe("low");
    storyNode(graph).data.quality = "high";
    expect(storyJob()?.quality).toBe("high");
  });

  it("referência da demanda não entra no node de stories", () => {
    const row = {
      id: "r1",
      storage_url: "https://x/ref.png",
      role: null,
      category: null,
      arte_index: null,
      position: 0,
    };
    const synced = syncDemandReferencesIntoGraph(gerarFluxoDaDemanda(demanda, 1), demanda.id, [row]);
    const story = storyNode(synced);
    expect(synced.edges.some((e) => e.target === story.id && e.source.includes("dbref"))).toBe(false);
    expect(synced.edges.some((e) => e.target !== story.id && e.source.includes("dbref"))).toBe(true);
  });

  it("desliga do stories a referência da demanda ligada por syncs antigos", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const story = storyNode(graph);
    const refId = "referenciaImagem-dbref-r1";
    graph.nodes.push({
      id: refId,
      type: "referenciaImagem",
      position: { x: 0, y: 0 },
      data: { imageUrl: "https://x/ref.png", label: "Estilo", intent: "Estilo: siga" },
    });
    graph.edges.push({ id: "e-old", source: refId, target: story.id, targetHandle: "refs" });
    story.data.promptText = `${STORY_PROMPT}
@(estilo) — siga`;

    const synced = syncDemandReferencesIntoGraph(graph, demanda.id, []);
    expect(synced.edges.some((e) => e.id === "e-old")).toBe(false);
    expect(storyNode(synced).data.promptText).toBe(STORY_PROMPT);
  });
});
