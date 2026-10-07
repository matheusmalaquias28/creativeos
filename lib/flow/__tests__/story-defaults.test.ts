import { describe, expect, it } from "vitest";
import { gerarFluxoDaDemanda } from "@/lib/flow/generator";
import { enrichFlowGraphWithProfile } from "@/lib/flow/enrich-graph";
import { extractFlowJobParams } from "@/lib/flow/extract-flow-jobs";
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

  it("enrich troca o texto padrão antigo e força low; texto editado fica", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    const node = storyNode(graph);
    node.data.promptText = LEGACY_STORY_PROMPTS[0];
    node.data.quality = "high";
    expect(storyNode(enrichFlowGraphWithProfile(graph, null)).data).toMatchObject({
      promptText: STORY_PROMPT,
      quality: "low",
    });

    node.data.promptText = "Meu texto de stories";
    expect(storyNode(enrichFlowGraphWithProfile(graph, null)).data.promptText).toBe(
      "Meu texto de stories"
    );
  });

  it("job de stories sai sempre low", () => {
    const graph = gerarFluxoDaDemanda(demanda, 1);
    storyNode(graph).data.quality = "high";
    const story = extractFlowJobParams(graph, demanda.briefing, { includeStory: true }).find(
      (j) => j.skip_logo
    );
    expect(story?.quality).toBe("low");
  });
});
