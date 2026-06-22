// ─── Node type discriminants ──────────────────────────────────────────────

export type NodeType =
  | 'clienteLogo'
  | 'clienteReferencias'
  | 'promptArte'
  | 'gerarImagem'
  | 'saidaArte';

// ─── Per-node data shapes ─────────────────────────────────────────────────

export type ClienteLogoData = {
  clientId: string;
  logoUrl?: string | null;
};

export type ClienteReferenciasData = {
  clientId: string;
  referenceUrls?: string[];
};

/** Text fields may contain @img1, @img2, … tokens resolved at runtime. */
export type PromptArteData = {
  artIndex: number;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  /** Texto completo do editor — fonte de verdade persistida no fluxo. */
  promptText?: string | null;
};

export type GerarImagemData = {
  aspectRatio?: string;
  imageSize?: string;
  /** Injected at generation time — not serialized to graph. */
  demandId?: string;
  clientId?: string;
  briefingTitulo?: string | null;
  briefingTipo?: string | null;
};

export type SaidaArteData = {
  artIndex: number;
  label?: string;
  /** Runtime-only — injected by Realtime, never persisted to flow_graph. */
  resultUrl?: string | null;
  generatingStatus?: "queued" | "processing" | "succeeded" | "failed";
  jobId?: string;
};

/** Imagem arrastada para dentro do canvas — funciona como referência extra. */
export type ReferenciaImagemData = {
  imageUrl: string | null;
  label?: string;
};

// ─── Discriminated union node ─────────────────────────────────────────────

export type FlowNode =
  | { id: string; type: 'clienteLogo'; data: ClienteLogoData; position: { x: number; y: number } }
  | { id: string; type: 'clienteReferencias'; data: ClienteReferenciasData; position: { x: number; y: number } }
  | { id: string; type: 'promptArte'; data: PromptArteData; position: { x: number; y: number } }
  | { id: string; type: 'gerarImagem'; data: GerarImagemData; position: { x: number; y: number } }
  | { id: string; type: 'saidaArte'; data: SaidaArteData; position: { x: number; y: number } }
  | { id: string; type: 'referenciaImagem'; data: ReferenciaImagemData; position: { x: number; y: number } };

// ─── Edge ────────────────────────────────────────────────────────────────

export type FlowEdge = {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
};

// ─── Graph ───────────────────────────────────────────────────────────────

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};
