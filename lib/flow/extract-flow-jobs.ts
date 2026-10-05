import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import { buildLogoDirective } from "@/lib/flow/logo-directive";
import { extractMentionInstruction } from "@/lib/flow/mention-text";
import { getPromptArteEditorText, resolvePromptArteFields } from "@/lib/flow/prompt-arte-text";
import type { Json } from "@/types/database";
import type {
  ArteData,
  FlowGraph,
  FlowNode,
  ListaImagensData,
  PromptArteData,
  ReferenciaImagemData,
  SaidaArteData,
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
  model: string;
  quality: "low" | "medium" | "high";
  /** Quantas imagens gerar para este node (pilha). Default 1. */
  count: number;
  /**
   * Quando presente (Lista em modo "list"), o node gera UMA imagem por URL,
   * cada uma usando essa URL como referência principal — fan-out. Vence `count`.
   */
  fanout_reference_urls?: string[] | null;
  /** Stories: reenquadra a arte já pronta — não recompor logo (ela já está lá). */
  skip_logo?: boolean;
  /** Posição/tamanho da logo (quando enviada como referência no Space). */
  logo_position?: string | null;
  logo_size?: string | null;
  /**
   * Frase de instrução da logo já resolvida — vem da linha `@(logo) — ...`
   * no texto do prompt (ver mention-text.ts). Nunca recomputada "escondida"
   * a partir de logo_position/logo_size no worker; esses dois campos só
   * continuam existindo para o seletor da UI refletir o valor atual.
   */
  logo_directive?: string | null;
  briefing_titulo?: string | null;
  briefing_tipo?: string | null;
  flow_logo_url: string | null;
  flow_references: FlowReferenceEntry[];
};

/** Um alvo de @(label) — skipAutoAdd evita duplicar refs já adicionadas por outra edge. */
type NamedRef = { url: string; skipAutoAdd?: boolean };

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

/**
 * Resolve a instrução de uso de uma referência. A única fonte de verdade é a
 * linha `@(label) — instrução` no texto do prompt (editável pelo operador) —
 * se ele editar ou apagar essa linha, isso tem que mudar o que vai pro
 * modelo. `storedIntent` (vindo do acervo, no momento em que a imagem foi
 * adicionada) só serve de fallback para quando a linha nunca existiu ou foi
 * removida do texto.
 */
function resolveReferenceRole(
  promptText: string,
  label: string | undefined,
  storedIntent: string | undefined
): string {
  if (label) {
    const inline = extractMentionInstruction(promptText, normalizeRefName(label));
    if (inline) return inline;
  }
  if (storedIntent?.trim()) return storedIntent.trim();
  return label
    ? `use a referência "${label}" como guia visual principal`
    : "use esta imagem como referência visual";
}

function addReferenciaImagemNode(
  node: FlowNode,
  refs: FlowReferenceEntry[],
  seen: Set<string>,
  promptText: string
) {
  if (node.type !== "referenciaImagem") return;
  const data = node.data as ReferenciaImagemData;
  const label = data.label?.trim();
  const role = resolveReferenceRole(promptText, label, data.intent);
  addReference(refs, seen, data.imageUrl, role);
}

function resolveNamedRefTokens(
  text: string | null | undefined,
  namedRefMap: Map<string, NamedRef>,
  refs: FlowReferenceEntry[],
  seen: Set<string>
): string | null {
  if (!text) return null;

  const result = text.replace(/@\(([^)]+)\)/g, (match, name: string) => {
    const key = normalizeRefName(name);
    const ref = namedRefMap.get(key);
    if (ref) {
      if (!ref.skipAutoAdd) {
        addReference(
          refs,
          seen,
          ref.url,
          `referência citada no prompt: ${name.replace(/-/g, " ")}`
        );
      }
      return name.replace(/-/g, " ");
    }
    return match;
  });

  return result || null;
}

/**
 * URLs estáticas das imagens que alimentam um node de Lista. Entradas geradas em
 * runtime (saidaArte) não têm URL no momento da extração e são ignoradas aqui —
 * o fan-out sobre artes geradas (ex.: feed → stories) é tratado pelo pipeline de
 * stories em duas fases, não por este extractor de passada única.
 */
function collectListItems(
  listId: string,
  nodeById: Map<string, FlowNode>,
  predecessors: Map<string, string[]>
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined) => {
    if (url?.trim() && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  // URLs materializadas na própria lista (imagens já geradas despejadas nela).
  (nodeById.get(listId)?.data as ListaImagensData | undefined)?.items?.forEach(push);

  for (const predId of predecessors.get(listId) ?? []) {
    const node = nodeById.get(predId);
    if (!node) continue;
    if (node.type === "referenciaImagem") push((node.data as ReferenciaImagemData).imageUrl);
    else if (node.type === "clienteLogo") push(node.data.logoUrl);
    else if (node.type === "clienteReferencias")
      (node.data.referenceUrls ?? []).forEach(push);
  }
  return urls;
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
  const fullText =
    promptNode?.type === "promptArte"
      ? getPromptArteEditorText(promptNode.data as PromptArteData)
      : "";

  const refs: FlowReferenceEntry[] = [];
  const seen = new Set<string>();
  let logoUrl: string | null = null;

  const namedRefMap = new Map<string, NamedRef>();

  if (promptId) {
    for (const refId of predecessors.get(promptId) ?? []) {
      const refNode = nodeById.get(refId);
      if (!refNode) continue;

      if (refNode.type === "referenciaImagem") {
        const data = refNode.data as ReferenciaImagemData;
        if (!data.imageUrl) continue;
        const key = normalizeRefName(data.label ?? refId);
        namedRefMap.set(key, { url: data.imageUrl });
        addReferenciaImagemNode(refNode, refs, seen, fullText);
        continue;
      }

      // Logo/refs do cliente conectados ao promptArte só habilitam o @(mention) no
      // texto — já entram como flow_logo_url/flow_references pela edge com
      // gerarImagem, então skipAutoAdd evita duplicar a referência.
      if (refNode.type === "clienteLogo" && refNode.data.logoUrl) {
        namedRefMap.set("logo", { url: refNode.data.logoUrl, skipAutoAdd: true });
        continue;
      }

      if (refNode.type === "clienteReferencias") {
        (refNode.data.referenceUrls ?? []).forEach((url, i) => {
          namedRefMap.set(`ref-cliente-${i + 1}`, { url, skipAutoAdd: true });
        });
      }
    }
  }

  let fanoutUrls: string[] | null = null;

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
      addReferenciaImagemNode(node, refs, seen, fullText);
      continue;
    }

    if (node.type === "listaImagens") {
      const items = collectListItems(predId, nodeById, predecessors);
      const mode = (node.data as ListaImagensData).mode ?? "reference";
      if (mode === "list") {
        // Fan-out: uma geração por item (resolvido no worker).
        if (items.length > 0) fanoutUrls = items;
      } else {
        // Referência: todos os itens entram como referência de uma geração.
        for (const url of items) {
          addReference(refs, seen, url, "item da lista — use como referência visual");
        }
      }
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
    aspect_ratio: gerarNode.data.aspectRatio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
    image_size: gerarNode.data.imageSize ?? IMAGE_GEN_DEFAULTS.imageSize,
    model: gerarNode.data.model ?? IMAGE_GEN_DEFAULTS.model,
    quality: gerarNode.data.quality ?? IMAGE_GEN_DEFAULTS.quality,
    count: Math.max(1, gerarNode.data.count ?? 1),
    fanout_reference_urls: fanoutUrls,
    briefing_titulo: briefing.titulo ?? null,
    briefing_tipo: briefing.tipo ?? null,
    flow_logo_url: logoUrl,
    flow_references: refs,
  };
}

/**
 * Extrai o job de um node unificado `arte` (prompt + controles + geração num só).
 * Diferente do trio antigo: os inputs (logo, refs, lista, imagem) conectam
 * direto no node arte, e o prompt vem do próprio node.
 */
function extractArteJob(
  nodeById: Map<string, FlowNode>,
  predecessors: Map<string, string[]>,
  arteId: string,
  briefing: { titulo?: string | null; tipo?: string | null }
): FlowJobParams | null {
  const arteNode = nodeById.get(arteId);
  if (arteNode?.type !== "arte") return null;
  const data = arteNode.data as ArteData;
  const fullText = getPromptArteEditorText(data);

  const refs: FlowReferenceEntry[] = [];
  const seen = new Set<string>();
  const namedRefMap = new Map<string, NamedRef>();
  let logoUrl: string | null = null;
  let fanoutUrls: string[] | null = null;

  for (const predId of predecessors.get(arteId) ?? []) {
    const node = nodeById.get(predId);
    if (!node) continue;

    if (node.type === "clienteLogo") {
      logoUrl = node.data.logoUrl ?? null;
      if (node.data.logoUrl) namedRefMap.set("logo", { url: node.data.logoUrl, skipAutoAdd: true });
      continue;
    }
    if (node.type === "clienteReferencias") {
      (node.data.referenceUrls ?? []).forEach((url, i) => {
        namedRefMap.set(`ref-cliente-${i + 1}`, { url, skipAutoAdd: true });
        addReference(refs, seen, url, "siga o estilo visual desta referência do cliente");
      });
      continue;
    }
    if (node.type === "referenciaImagem") {
      const d = node.data as ReferenciaImagemData;
      if (d.imageUrl) namedRefMap.set(normalizeRefName(d.label ?? predId), { url: d.imageUrl });
      addReferenciaImagemNode(node, refs, seen, fullText);
      continue;
    }
    if (node.type === "listaImagens") {
      const items = collectListItems(predId, nodeById, predecessors);
      const mode = (node.data as ListaImagensData).mode ?? "reference";
      if (mode === "list") {
        if (items.length > 0) fanoutUrls = items;
      } else {
        for (const url of items) {
          addReference(refs, seen, url, "item da lista — use como referência visual");
        }
      }
    }
  }

  const rawPrompt = resolvePromptArteFields(data);
  const headline = resolveNamedRefTokens(rawPrompt.headline, namedRefMap, refs, seen);
  const subheadline = resolveNamedRefTokens(rawPrompt.subheadline, namedRefMap, refs, seen);
  const cta = resolveNamedRefTokens(rawPrompt.cta, namedRefMap, refs, seen);
  const informacoesExtras = resolveNamedRefTokens(
    rawPrompt.informacoesExtras,
    namedRefMap,
    refs,
    seen
  );

  // A frase da logo vem da linha `@(logo) — ...` que o próprio seletor da UI
  // colou no prompt (ver arte-node.tsx). Só cai no fallback computado se essa
  // linha nunca existiu (grafo salvo antes dessa mudança, por exemplo) — o
  // worker nunca recalcula isso escondido a partir de logo_position/logo_size.
  const logoDirective =
    extractMentionInstruction(fullText, "logo") ??
    buildLogoDirective(data.logoPosition ?? undefined, data.logoSize ?? undefined);

  return {
    art_index: data.artIndex,
    headline,
    subheadline,
    cta,
    informacoesExtras,
    aspect_ratio: data.aspectRatio ?? IMAGE_GEN_DEFAULTS.aspectRatio,
    image_size: data.imageSize ?? IMAGE_GEN_DEFAULTS.imageSize,
    model: data.model ?? IMAGE_GEN_DEFAULTS.model,
    quality: data.quality ?? IMAGE_GEN_DEFAULTS.quality,
    count: Math.max(1, data.count ?? 1),
    fanout_reference_urls: fanoutUrls,
    skip_logo: data.format === "story",
    logo_position: data.logoPosition ?? null,
    logo_size: data.logoSize ?? null,
    logo_directive: logoDirective,
    briefing_titulo: briefing.titulo ?? null,
    briefing_tipo: briefing.tipo ?? null,
    flow_logo_url: logoUrl,
    flow_references: refs,
  };
}

/**
 * Mapeia um FlowJobParams para o objeto `params` (jsonb) de art_generation_job.
 * Usado pelas rotas de run/run-node para não divergirem nos campos.
 */
export function flowJobParamsToRow(p: FlowJobParams): Json {
  return {
    headline: p.headline,
    subheadline: p.subheadline,
    cta: p.cta,
    informacoesExtras: p.informacoesExtras,
    aspect_ratio: p.aspect_ratio,
    image_size: p.image_size,
    model: p.model,
    quality: p.quality,
    count: p.count,
    fanout_reference_urls: p.fanout_reference_urls ?? null,
    skip_logo: p.skip_logo ?? false,
    logo_position: p.logo_position ?? null,
    logo_size: p.logo_size ?? null,
    logo_directive: p.logo_directive ?? null,
    briefing_titulo: p.briefing_titulo,
    briefing_tipo: p.briefing_tipo,
    flow_logo_url: p.flow_logo_url,
    flow_references: p.flow_references,
  };
}

export function extractFlowJobParams(
  graph: FlowGraph,
  briefing: { titulo?: string | null; tipo?: string | null },
  opts?: { demandId?: string; includeStory?: boolean }
): FlowJobParams[] {
  const nodeById = new Map<string, FlowNode>(graph.nodes.map((n) => [n.id, n]));
  const predecessors = buildPredecessorMap(graph);
  const jobs: FlowJobParams[] = [];

  for (const node of graph.nodes) {
    // Node unificado (estrutura nova): é prompt + geração + saída.
    if (node.type === "arte") {
      const data = node.data as ArteData;
      // Stories (9:16) só entram com disparo explícito (run-node), nunca no
      // "Executar" geral — senão rodariam antes das artes feed existirem.
      if (data.format === "story" && !opts?.includeStory) continue;
      if (opts?.demandId && data.demandId !== opts.demandId) continue;
      const job = extractArteJob(nodeById, predecessors, node.id, briefing);
      if (job) jobs.push(job);
      continue;
    }

    // Trio legado promptArte→gerarImagem→saidaArte (compat).
    if (node.type !== "saidaArte") continue;
    // Saídas de Stories (9:16) são geradas pelo worker de 2 fases a partir das
    // artes feed — não viram job de feed aqui.
    if ((node.data as SaidaArteData).format === "story") continue;
    if (opts?.demandId && (node.data as SaidaArteData).demandId !== opts.demandId) continue;

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
