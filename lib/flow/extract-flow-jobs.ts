import { resolvePromptArteFields } from "@/lib/flow/prompt-arte-text";
import type {
  FlowGraph,
  FlowNode,
  PromptArteData,
  ReferenciaImagemData,
} from "@/lib/flow/types";

export type FlowReferenceEntry = {
  url: string;
  role: string | null;
};

export type FlowJobParams = {
  art_index: number;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  aspect_ratio: string;
  image_size: string;
  briefing_titulo?: string | null;
  briefing_tipo?: string | null;
  flow_logo_url: string | null;
  flow_references: FlowReferenceEntry[];
};

function normalizeRefName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

function buildPredecessorMap(graph: FlowGraph): Map<string, string[]> {
  const predecessors = new Map<string, string[]>();
  for (const node of graph.nodes) predecessors.set(node.id, []);
  for (const edge of graph.edges) {
    predecessors.get(edge.target)?.push(edge.source);
  }
  return predecessors;
}

function addReference(
  refs: FlowReferenceEntry[],
  seen: Set<string>,
  url: string | null | undefined,
  role: string | null
) {
  if (!url?.trim() || seen.has(url)) return;
  seen.add(url);
  refs.push({ url, role });
}

function addReferenciaImagemNode(
  node: FlowNode,
  refs: FlowReferenceEntry[],
  seen: Set<string>
) {
  if (node.type !== "referenciaImagem") return;
  const data = node.data as ReferenciaImagemData;
  const label = data.label?.trim();
  addReference(
    refs,
    seen,
    data.imageUrl,
    label
      ? `use a referência "${label}" como guia visual principal`
      : "use esta imagem como referência visual"
  );
}

function resolveNamedRefTokens(
  text: string | null | undefined,
  namedRefMap: Map<string, string>,
  refs: FlowReferenceEntry[],
  seen: Set<string>
): string | null {
  if (!text) return null;

  const result = text.replace(/@\(([^)]+)\)/g, (match, name: string) => {
    const key = normalizeRefName(name);
    const url = namedRefMap.get(key);
    if (url) {
      addReference(
        refs,
        seen,
        url,
        `referência citada no prompt: ${name.replace(/-/g, " ")}`
      );
      return name.replace(/-/g, " ");
    }
    return match;
  });

  return result || null;
}

function extractPipelineJob(
  graph: FlowGraph,
  nodeById: Map<string, FlowNode>,
  predecessors: Map<string, string[]>,
  gerarId: string,
  saidaArtIndex: number,
  briefing: { titulo?: string | null; tipo?: string | null }
): FlowJobParams | null {
  const gerarNode = nodeById.get(gerarId);
  if (gerarNode?.type !== "gerarImagem") return null;

  const gerarPreds = predecessors.get(gerarId) ?? [];
  const promptId = gerarPreds.find((id) => nodeById.get(id)?.type === "promptArte");
  const promptNode = promptId ? nodeById.get(promptId) : undefined;

  const refs: FlowReferenceEntry[] = [];
  const seen = new Set<string>();
  let logoUrl: string | null = null;

  const namedRefMap = new Map<string, string>();

  if (promptId) {
    for (const refId of predecessors.get(promptId) ?? []) {
      const refNode = nodeById.get(refId);
      if (refNode?.type !== "referenciaImagem") continue;
      const data = refNode.data as ReferenciaImagemData;
      if (!data.imageUrl) continue;
      const key = normalizeRefName(data.label ?? refId);
      namedRefMap.set(key, data.imageUrl);
      addReferenciaImagemNode(refNode, refs, seen);
    }
  }

  for (const predId of gerarPreds) {
    const node = nodeById.get(predId);
    if (!node) continue;

    if (node.type === "clienteLogo") {
      logoUrl = node.data.logoUrl ?? null;
      continue;
    }

    if (node.type === "clienteReferencias") {
      for (const url of node.data.referenceUrls ?? []) {
        addReference(
          refs,
          seen,
          url,
          "siga o estilo visual desta referência do cliente"
        );
      }
      continue;
    }

    if (node.type === "referenciaImagem") {
      addReferenciaImagemNode(node, refs, seen);
    }
  }

  const rawPrompt =
    promptNode?.type === "promptArte"
      ? resolvePromptArteFields(promptNode.data as PromptArteData)
      : null;

  const headline = resolveNamedRefTokens(
    rawPrompt?.headline,
    namedRefMap,
    refs,
    seen
  );
  const subheadline = resolveNamedRefTokens(
    rawPrompt?.subheadline,
    namedRefMap,
    refs,
    seen
  );
  const cta = resolveNamedRefTokens(rawPrompt?.cta, namedRefMap, refs, seen);
  const informacoesExtras = resolveNamedRefTokens(
    rawPrompt?.informacoesExtras,
    namedRefMap,
    refs,
    seen
  );

  return {
    art_index: saidaArtIndex,
    headline,
    subheadline,
    cta,
    informacoesExtras,
    aspect_ratio: gerarNode.data.aspectRatio ?? "1:1",
    image_size: gerarNode.data.imageSize ?? "2K",
    briefing_titulo: briefing.titulo ?? null,
    briefing_tipo: briefing.tipo ?? null,
    flow_logo_url: logoUrl,
    flow_references: refs,
  };
}

export function extractFlowJobParams(
  graph: FlowGraph,
  briefing: { titulo?: string | null; tipo?: string | null }
): FlowJobParams[] {
  const nodeById = new Map<string, FlowNode>(graph.nodes.map((n) => [n.id, n]));
  const predecessors = buildPredecessorMap(graph);
  const jobs: FlowJobParams[] = [];

  for (const node of graph.nodes) {
    if (node.type !== "saidaArte") continue;

    const gerarId = (predecessors.get(node.id) ?? []).find(
      (id) => nodeById.get(id)?.type === "gerarImagem"
    );
    if (!gerarId) continue;

    const job = extractPipelineJob(
      graph,
      nodeById,
      predecessors,
      gerarId,
      node.data.artIndex,
      briefing
    );
    if (job) jobs.push(job);
  }

  return jobs.sort((a, b) => a.art_index - b.art_index);
}
