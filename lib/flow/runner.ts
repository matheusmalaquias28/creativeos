import type { FlowGraph, FlowNode } from './types';
import type { ArtSpec, CreativeProfile } from '@/lib/ai/imagegen/prompt-compiler';
import { compilePrompt } from '@/lib/ai/imagegen/prompt-compiler';

// ─── ImageGenProvider ─────────────────────────────────────────────────────

export interface ImageGenProvider {
  generate(params: {
    prompt: string;
    referenceUrls: string[];
    aspectRatio: string;
    imageSize: string;
  }): Promise<{ url: string; base64: string; mimeType: string }>;
}

// ─── RunContext ───────────────────────────────────────────────────────────

export type RunContext = {
  fetchLogoUrl: (clientId: string) => Promise<string | null>;
  fetchReferenceUrls: (clientId: string) => Promise<string[]>;
  fetchCreativeProfile: (clientId: string) => Promise<CreativeProfile | null>;
  imageProvider: ImageGenProvider;
};

// ─── RunResult ────────────────────────────────────────────────────────────

export type ArtResult = {
  artIndex: number;
  url: string;
  base64: string;
  mimeType: string;
};

export type RunResult = {
  arts: ArtResult[];
};

// ─── Internal node output types ───────────────────────────────────────────

type NodeOutput =
  | { kind: 'logo'; url: string | null }
  | { kind: 'refs'; urls: string[] }
  | { kind: 'named-ref'; label: string; url: string }  // from referenciaImagem
  | { kind: 'prompt'; artSpec: ArtSpec; extraRefs: string[] }
  | { kind: 'image'; url: string; base64: string; mimeType: string };

function normalizeRefName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

// ─── Topological sort (Kahn's algorithm) ─────────────────────────────────

function topologicalSort(graph: FlowGraph): FlowNode[] {
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    outEdges.set(node.id, []);
  }

  for (const edge of graph.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    outEdges.get(edge.source)?.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const sorted: FlowNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeById.get(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    sorted.push(node);

    for (const neighbor of outEdges.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== graph.nodes.length) {
    throw new Error('Ciclo detectado no grafo — execução abortada');
  }

  return sorted;
}

// ─── @imgN token resolution ───────────────────────────────────────────────

/**
 * Substitui @img1, @img2, … pela URL do resultado gerado na posição N (1-based).
 * Tokens com índice fora do intervalo são preservados sem alteração.
 * Retorna também as URLs que foram resolvidas (para passá-las como referências visuais).
 */
function resolveImgTokens(
  text: string,
  imageOutputs: { url: string }[]
): { resolved: string; refs: string[] } {
  const refs: string[] = [];
  const resolved = text.replace(/@img(\d+)/g, (match, numStr: string) => {
    const idx = parseInt(numStr, 10) - 1; // 1-based → 0-based
    if (idx >= 0 && idx < imageOutputs.length) {
      refs.push(imageOutputs[idx].url);
      return imageOutputs[idx].url;
    }
    return match; // token não resolvido — preserva
  });
  return { resolved, refs };
}

function resolveField(
  text: string | null | undefined,
  imageOutputs: { url: string }[]
): { resolved: string | null | undefined; refs: string[] } {
  if (!text) return { resolved: text, refs: [] };
  return resolveImgTokens(text, imageOutputs);
}

// ─── runGraph ─────────────────────────────────────────────────────────────

export async function runGraph(graph: FlowGraph, context: RunContext): Promise<RunResult> {
  // Throws synchronously if there's a cycle (promise rejects)
  const sorted = topologicalSort(graph);

  const outputs = new Map<string, NodeOutput>();
  // Ordered list of gerarImagem outputs — indexed by @imgN tokens (1-based)
  const imageOutputs: { url: string; base64: string; mimeType: string }[] = [];

  // Build predecessor map from edges
  const predecessors = new Map<string, string[]>();
  for (const node of graph.nodes) predecessors.set(node.id, []);
  for (const edge of graph.edges) {
    predecessors.get(edge.target)?.push(edge.source);
  }

  const arts: ArtResult[] = [];

  for (const node of sorted) {
    const preds = predecessors.get(node.id) ?? [];

    switch (node.type) {
      case 'clienteLogo': {
        const url = await context.fetchLogoUrl(node.data.clientId);
        outputs.set(node.id, { kind: 'logo', url });
        break;
      }

      case 'clienteReferencias': {
        const urls = await context.fetchReferenceUrls(node.data.clientId);
        outputs.set(node.id, { kind: 'refs', urls });
        break;
      }

      case 'promptArte': {
        const d = node.data;

        // Build map: normalizedName → url from referenciaImagem predecessors
        const namedRefMap = new Map<string, string>();
        for (const predId of preds) {
          const out = outputs.get(predId);
          if (out?.kind === 'named-ref' && out.url) {
            namedRefMap.set(normalizeRefName(out.label), out.url);
          }
        }

        const extraRefs: string[] = [];

        const resolve = (text: string | null | undefined): string | null | undefined => {
          if (!text) return text;
          // Step 1: @imgN (positional, legacy)
          const r1 = resolveImgTokens(text, imageOutputs);
          extraRefs.push(...r1.refs);
          // Step 2: @(name) — named image references
          const resolved = r1.resolved.replace(/@\(([^)]+)\)/g, (match, name: string) => {
            const url = namedRefMap.get(normalizeRefName(name));
            if (url) { extraRefs.push(url); return url; }
            return match; // token não resolvido — preservar
          });
          return resolved;
        };

        const artSpec: ArtSpec = {
          headline: resolve(d.headline),
          subheadline: resolve(d.subheadline),
          cta: resolve(d.cta),
          informacoesExtras: resolve(d.informacoesExtras),
        };

        outputs.set(node.id, { kind: 'prompt', artSpec, extraRefs });
        break;
      }

      case 'referenciaImagem': {
        outputs.set(node.id, {
          kind: 'named-ref',
          label: node.data.label ?? node.id,
          url: node.data.imageUrl ?? '',
        });
        break;
      }

      case 'gerarImagem': {
        let logoUrl: string | null = null;
        const refUrls: string[] = [];
        let artSpec: ArtSpec = {};
        let extraRefs: string[] = [];
        let clientId = '';

        for (const predId of preds) {
          const out = outputs.get(predId);
          if (!out) continue;
          if (out.kind === 'logo') {
            logoUrl = out.url;
            const logoNode = graph.nodes.find((n) => n.id === predId);
            if (logoNode?.type === 'clienteLogo') clientId = logoNode.data.clientId;
          } else if (out.kind === 'refs') {
            refUrls.push(...out.urls);
          } else if (out.kind === 'named-ref' && out.url) {
            refUrls.push(out.url); // imagens arrastadas conectadas diretamente ao gerarImagem
          } else if (out.kind === 'prompt') {
            artSpec = out.artSpec;
            extraRefs = out.extraRefs;
          }
        }

        const profile = await context.fetchCreativeProfile(clientId);
        const creativeProfile: CreativeProfile = profile ?? {
          base_prompt: '',
          palette: [],
          logo_mode: 'composite',
          style_reference_urls: [],
        };

        const compiled = compilePrompt(creativeProfile, {}, artSpec, []);

        const referenceUrls: string[] = [
          ...creativeProfile.style_reference_urls,
          ...(creativeProfile.logo_mode === 'reference' && logoUrl ? [logoUrl] : []),
          ...refUrls,
          ...extraRefs, // URLs resolvidas de @imgN — passadas como referências visuais
        ];

        const result = await context.imageProvider.generate({
          prompt: compiled,
          referenceUrls,
          aspectRatio: node.data.aspectRatio ?? '3:4',
          imageSize: node.data.imageSize ?? '2K',
        });

        imageOutputs.push(result);
        outputs.set(node.id, { kind: 'image', ...result });
        break;
      }

      case 'saidaArte': {
        const predOut = preds.length > 0 ? outputs.get(preds[0]) : undefined;
        if (predOut?.kind === 'image') {
          arts.push({
            artIndex: node.data.artIndex,
            url: predOut.url,
            base64: predOut.base64,
            mimeType: predOut.mimeType,
          });
        }
        break;
      }
    }
  }

  return { arts };
}
