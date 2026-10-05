// ─── Node type discriminants ──────────────────────────────────────────────

export type NodeType =
  | 'clienteLogo'
  | 'clienteReferencias'
  | 'promptArte'
  | 'gerarImagem'
  | 'saidaArte'
  | 'listaImagens'
  | 'referenciaImagem'
  | 'arte';

// ─── Per-node data shapes ─────────────────────────────────────────────────

export type ClienteLogoData = {
  clientId: string;
  logoUrl?: string | null;
  /** Nome exibido no canvas (editável). */
  label?: string;
};

export type ClienteReferenciasData = {
  clientId: string;
  referenceUrls?: string[];
};

/** Campos de copy/prompt compartilhados entre promptArte e o node unificado arte. */
export type PromptFields = {
  artIndex: number;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  /** Texto completo do editor — fonte de verdade persistida no fluxo. */
  promptText?: string | null;
};

/** Text fields may contain @img1, @img2, … tokens resolved at runtime. */
export type PromptArteData = PromptFields;

export type GerarImagemData = {
  aspectRatio?: string;
  imageSize?: string;
  /** "gemini" ou o slug de um modelo Magnific (ex: "gpt-2"). Default: "gpt-2". */
  model?: string;
  /** Esforço do GPT Image (low/medium/high). Default: "medium". */
  quality?: "low" | "medium" | "high";
  /** Quantas imagens este node gera (pilha navegável no saidaArte). Default: 1. */
  count?: number;
  /** Persistido no grafo — usado para escopar execução quando o fluxo é compartilhado por cliente. */
  demandId?: string;
  clientId?: string;
  briefingTitulo?: string | null;
  briefingTipo?: string | null;
};

export type SaidaArteData = {
  artIndex: number;
  label?: string;
  /**
   * "feed" (3:4/4:5, default) ou "story" (9:16). A saída "story" é alimentada
   * pelo worker de stories de 2 fases, não pela extração de passada única.
   */
  format?: 'feed' | 'story';
  /** Persistido no grafo — usado para escopar execução quando o fluxo é compartilhado por cliente. */
  demandId?: string;
  /** Runtime-only — injected by Realtime, never persisted to flow_graph. */
  resultUrl?: string | null;
  /** Pilha de versões geradas por este node (runtime-only). */
  resultUrls?: { versionId: string; url: string }[];
  generatingStatus?: "queued" | "processing" | "succeeded" | "failed";
  jobId?: string;
};

/** Imagem arrastada para dentro do canvas — funciona como referência extra. */
export type ReferenciaImagemData = {
  imageUrl: string | null;
  label?: string;
  /** Categoria de uso vinda do acervo (subject/brand/style/environment). */
  category?: string;
  /** Instrução de como usar a imagem — vira o `role` da referência na geração. */
  intent?: string;
};

/**
 * Node unificado (estilo Freepik): prompt + controles + geração + resultado num
 * só card. Substitui o trio promptArte→gerarImagem→saidaArte no grafo padrão.
 * Carrega os mesmos campos de copy (PromptFields), controles de geração e o
 * estado de runtime da saída (resultUrl/pilha/status).
 */
export type ArteData = PromptFields & {
  label?: string;
  format?: 'feed' | 'story';
  // Controles de geração
  aspectRatio?: string;
  imageSize?: string;
  model?: string;
  quality?: 'low' | 'medium' | 'high';
  count?: number;
  /** Posição/tamanho da logo (quando enviada como referência). Ver logo-directive.ts */
  logoPosition?: string;
  logoSize?: 'small' | 'medium' | 'large';
  /**
   * A identidade de marca do cliente (base_prompt/paleta) já foi semeada como
   * linha visível no prompt deste node — ver enrich-graph.ts. Uma vez `true`,
   * nunca mais reaparece sozinha: apagar a linha é definitivo.
   */
  brandIdentitySeeded?: boolean;
  // Contexto
  demandId?: string;
  clientId?: string;
  briefingTitulo?: string | null;
  briefingTipo?: string | null;
  // Runtime (nunca persistido — ver rfToGraph)
  resultUrl?: string | null;
  resultUrls?: { versionId: string; url: string }[];
  generatingStatus?: 'queued' | 'processing' | 'succeeded' | 'failed';
  jobId?: string;
};

/**
 * Agrega as imagens das suas entradas e expõe uma única saída. O `mode` diz ao
 * node de geração a jusante COMO consumir a lista:
 *  - "reference": todas as imagens entram como referências de UMA geração.
 *  - "list": fan-out — o node de geração roda UMA vez por item da lista.
 */
export type ListaImagensData = {
  label?: string;
  mode?: 'reference' | 'list';
  /**
   * URLs "materializadas" — imagens já geradas despejadas nesta lista (ex.: um
   * node de imagem que gerou várias). Persistem no grafo, então o servidor
   * consegue fazer o fan-out mesmo sem ver os resultados de runtime dos nodes.
   */
  items?: string[];
};

// ─── Discriminated union node ─────────────────────────────────────────────

export type FlowNode =
  | { id: string; type: 'clienteLogo'; data: ClienteLogoData; position: { x: number; y: number } }
  | { id: string; type: 'clienteReferencias'; data: ClienteReferenciasData; position: { x: number; y: number } }
  | { id: string; type: 'promptArte'; data: PromptArteData; position: { x: number; y: number } }
  | { id: string; type: 'gerarImagem'; data: GerarImagemData; position: { x: number; y: number } }
  | { id: string; type: 'saidaArte'; data: SaidaArteData; position: { x: number; y: number } }
  | { id: string; type: 'referenciaImagem'; data: ReferenciaImagemData; position: { x: number; y: number } }
  | { id: string; type: 'listaImagens'; data: ListaImagensData; position: { x: number; y: number } }
  | { id: string; type: 'arte'; data: ArteData; position: { x: number; y: number } };

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
