import { MagnificMcpSession, MagnificToolError } from "./mcp-client";
import { firstString } from "./extract";

// Aspect ratios conhecidos por modelo Magnific — usado só pra validar antes de
// chamar (evitar um erro tardio no servidor). Adicionar aqui conforme surgirem
// outros modelos.
const KNOWN_ASPECT_RATIOS: Record<string, string[]> = {
  "gpt-2": [
    "auto",
    "1:1",
    "2:1",
    "3:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "16:9",
    "9:16",
    "21:9",
  ],
};

// creations_wait long-polla até 25s por chamada; o loop abaixo limita o total.
const WAIT_TIMEOUT_SECONDS = 25;
const MAX_WAIT_CALLS = 8; // ~3,5 min de teto — o job do worker expira antes (2 min)

export class MagnificArtGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagnificArtGenerationError";
  }
}

export type GenerateMagnificArtInput = {
  model: string;
  quality: "low" | "medium" | "high";
  aspectRatio: string;
  /** "1k" | "2k" | "4k" — minúsculo, conforme o catálogo do Magnific. */
  resolution: string;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  informacoesExtras?: string | null;
  briefingTitulo?: string | null;
  briefingTipo?: string | null;
  logoUrl?: string | null;
  references: { url: string; role: string | null }[];
};

export type GenerateMagnificArtResult = { imageUrl: string };

function validateAspectRatio(model: string, aspectRatio: string): void {
  const allowed = KNOWN_ASPECT_RATIOS[model];
  if (allowed && !allowed.includes(aspectRatio)) {
    throw new MagnificArtGenerationError(
      `Aspect ratio "${aspectRatio}" não é suportado pelo modelo "${model}" (aceitos: ${allowed.join(", ")}).`
    );
  }
}

function buildPrompt(input: GenerateMagnificArtInput): string {
  const parts: string[] = [];

  if (input.briefingTitulo || input.briefingTipo) {
    parts.push([input.briefingTitulo, input.briefingTipo].filter(Boolean).join(" — "));
  }

  const copyParts: string[] = [];
  if (input.headline) copyParts.push(`Headline: ${input.headline}`);
  if (input.subheadline) copyParts.push(`Subheadline: ${input.subheadline}`);
  if (input.cta) copyParts.push(`CTA: ${input.cta}`);
  if (copyParts.length) parts.push(copyParts.join("  "));

  if (input.informacoesExtras) parts.push(input.informacoesExtras);

  // Regra que antes ia no prompt do agente: a logo entra como referência visual e
  // só é posicionada — nunca descrita ou usada como direção de estilo.
  if (input.logoUrl) {
    parts.push(
      "Posicione a logo (fornecida como imagem de referência) no canto superior esquerdo, em tamanho pequeno, sem alterações — não a use como referência de estilo, cor ou composição."
    );
  }

  return parts.join("\n\n") || "Arte para redes sociais baseada nas referências visuais fornecidas.";
}

function extractIdentifier(result: unknown, context: string): string {
  const id = firstString(result, ["identifier", "creationIdentifier", "id"]);
  if (!id) {
    throw new MagnificArtGenerationError(
      `${context}: resposta sem identifier — ${JSON.stringify(result).slice(0, 300)}`
    );
  }
  return id;
}

type CreationState = { status: string | null; url: string | null; error: string | null };

function extractCreationState(result: unknown): CreationState {
  return {
    status: firstString(result, ["status", "state"]),
    // `url` é o full-res (creations_get); originalUrl cobre o retorno de creation_status.
    url: firstString(result, ["url", "originalUrl", "imageUrl"]),
    error: firstString(result, ["error", "errorMessage", "failureReason"]),
  };
}

const TERMINAL_FAILED = new Set(["failed", "error", "canceled", "cancelled"]);

/**
 * Gera UMA arte via um modelo Magnific (ex: gpt-2) chamando o MCP direto do
 * backend — sem agente Claude no meio. Todos os passos são determinísticos:
 * upload da logo/referências (creations_upload_image), geração (images_generate)
 * e polling (creations_wait → creations_get). A logo e as referências entram em
 * `images_generate.references` como {type: "image", identifier} — influência
 * visual real, sem descrever o conteúdo delas no prompt.
 */
export async function generateMagnificArt(
  input: GenerateMagnificArtInput
): Promise<GenerateMagnificArtResult> {
  validateAspectRatio(input.model, input.aspectRatio);

  try {
    const session = await MagnificMcpSession.connect();

    // 1. Upload da logo + referências → identifiers
    const uploadUrls = [
      ...(input.logoUrl ? [input.logoUrl] : []),
      ...input.references.map((r) => r.url),
    ];
    const identifiers: string[] = [];
    for (const url of uploadUrls) {
      const uploaded = await session.callTool("creations_upload_image", { url });
      identifiers.push(extractIdentifier(uploaded, "creations_upload_image"));
    }

    // 2. Geração
    const generated = await session.callTool("images_generate", {
      prompt: buildPrompt(input),
      ...(input.model && input.model !== "auto" ? { mode: input.model } : {}),
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      quality: input.quality,
      count: 1,
      ...(identifiers.length
        ? { references: identifiers.map((identifier) => ({ type: "image", identifier })) }
        : {}),
    });
    const creationId = extractIdentifier(generated, "images_generate");

    // 3. Espera terminar (long-poll)
    let state = extractCreationState(generated);
    for (let i = 0; i < MAX_WAIT_CALLS && !isDone(state); i++) {
      const waited = await session.callTool("creations_wait", {
        identifiers: [creationId],
        timeoutSeconds: WAIT_TIMEOUT_SECONDS,
      });
      state = extractCreationState(waited);
    }

    if (state.status && TERMINAL_FAILED.has(state.status.toLowerCase())) {
      throw new MagnificArtGenerationError(
        `Geração falhou no Magnific (${state.status}): ${state.error ?? "sem detalhes"}`
      );
    }
    if (!isDone(state)) {
      throw new MagnificArtGenerationError(
        `Geração não terminou a tempo (último status: ${state.status ?? "desconhecido"}).`
      );
    }

    // 4. URL full-res — o payload do wait pode não trazer a URL final
    let imageUrl = state.url;
    if (!imageUrl) {
      const creation = await session.callTool("creations_get", {
        creationIdentifier: creationId,
      });
      imageUrl = extractCreationState(creation).url;
    }
    if (!imageUrl) {
      throw new MagnificArtGenerationError("Geração concluída, mas sem URL de imagem no retorno.");
    }

    return { imageUrl };
  } catch (error) {
    if (error instanceof MagnificArtGenerationError) throw error;
    if (error instanceof MagnificToolError) {
      throw new MagnificArtGenerationError(error.message);
    }
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    throw new MagnificArtGenerationError(message);
  }
}

function isDone(state: CreationState): boolean {
  const status = state.status?.toLowerCase() ?? null;
  if (status && (status === "completed" || status === "succeeded" || status === "done")) {
    return true;
  }
  // Sem status reconhecível mas com URL final → considera pronto.
  return status === null && state.url !== null;
}
