/**
 * Geração de imagem pela API REST do Magnific (nano-banana-pro).
 *
 * É a mesma API que o /gerador e o Turbo do carrossel já usam: cria uma task
 * com `MAGNIFIC_API_KEY`, faz polling até terminar e devolve a URL. Nada de
 * OAuth nem do cliente MCP de `lib/magnific/` — aquele caminho continua para o
 * Magnific Spaces e não tem relação com este.
 *
 * As referências vão como URL pública (não base64): a API baixa sozinha, o
 * payload fica pequeno e as imagens já estão públicas no Storage.
 *
 * Polling e não webhook: o worker roda dentro de `after()` numa function com
 * `maxDuration = 300`, então ele já está vivo esperando. Um webhook exigiria
 * uma tabela task→job e uma rota de callback para economizar um tempo que não
 * está sobrando — se a geração passar a estourar o teto, aí sim vale.
 */

import sharp from "sharp";

const MAGNIFIC_API = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro";

const POLL_INTERVAL_MS = 2500;
/** ~2min de teto — abaixo do IMAGE_JOB_TIMEOUT_MS (4min) do worker. */
const MAX_POLLS = 48;
/** Teto da API por chamada. */
const MAX_REFERENCES = 4;

export class MagnificImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagnificImageError";
  }
}

export type MagnificReference = {
  url: string;
  /** O papel desta imagem nesta arte — vira o `text` da referência. */
  text?: string | null;
};

export type MagnificImageParams = {
  prompt: string;
  references?: MagnificReference[];
  /** "3:4", "9:16", "1:1"… */
  aspectRatio?: string;
  /** "1K" | "2K" | "4K" */
  resolution?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mimeFromUrl(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function apiKey(): string {
  const key = process.env.MAGNIFIC_API_KEY?.trim();
  if (!key) throw new MagnificImageError("MAGNIFIC_API_KEY não configurada");
  return key;
}

const DONE = new Set(["COMPLETED", "SUCCEEDED", "SUCCESS", "DONE"]);
const FAILED = new Set(["FAILED", "ERROR", "CANCELED", "CANCELLED"]);

function pickUrl(generated: unknown): string | null {
  for (const item of (generated ?? []) as unknown[]) {
    if (typeof item === "string") return item;
    const o = item as Record<string, string | undefined>;
    const url = o?.url ?? o?.image_url ?? o?.image ?? o?.output;
    if (url) return url;
  }
  return null;
}

/** Cria a task e devolve o `task_id`. */
async function createTask(params: MagnificImageParams): Promise<string> {
  const payload: Record<string, unknown> = {
    prompt: params.prompt.trim(),
    aspect_ratio: params.aspectRatio ?? "3:4",
    resolution: params.resolution ?? "2K",
  };

  const refs = (params.references ?? []).slice(0, MAX_REFERENCES);
  if (refs.length > 0) {
    payload.reference_images = refs.map((ref) => ({
      image: ref.url,
      mime_type: mimeFromUrl(ref.url),
      ...(ref.text?.trim() ? { text: ref.text.trim() } : {}),
    }));
  }

  const res = await fetch(MAGNIFIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-magnific-api-key": apiKey() },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MagnificImageError(
      `Magnific ${res.status}: ${data?.message ?? "erro ao criar a geração"}`
    );
  }

  const taskId = data?.data?.task_id as string | undefined;
  if (!taskId) throw new MagnificImageError("Magnific não devolveu task_id");
  return taskId;
}

/** Espera a task terminar e devolve a URL da imagem. */
async function waitForImage(taskId: string): Promise<string> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${MAGNIFIC_API}/${taskId}`, {
      headers: { "x-magnific-api-key": apiKey() },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new MagnificImageError(
        `Magnific ${res.status} ao consultar a geração: ${data?.message ?? "sem detalhes"}`
      );
    }

    const status = String(data?.data?.status ?? "").toUpperCase();

    if (DONE.has(status)) {
      const url = pickUrl(data?.data?.generated);
      if (!url) throw new MagnificImageError("Geração concluída sem imagem no retorno");
      return url;
    }

    if (FAILED.has(status)) {
      throw new MagnificImageError(
        `Magnific: ${data?.data?.error ?? `geração ${status.toLowerCase()}`}`
      );
    }
  }

  throw new MagnificImageError(
    `Magnific não terminou em ${Math.round((MAX_POLLS * POLL_INTERVAL_MS) / 1000)}s`
  );
}

/**
 * Gera uma imagem e devolve os bytes em PNG.
 *
 * A URL da Magnific expira, e todo o resto do pipeline (composição da logo,
 * revisão com visão, upload ao Storage) trabalha com Buffer — então baixar
 * aqui é o ponto certo, não um detalhe de quem chama.
 */
export async function generateMagnificImage(
  params: MagnificImageParams
): Promise<{ buffer: Buffer; sourceUrl: string }> {
  if (!params.prompt?.trim()) {
    throw new MagnificImageError("Prompt vazio");
  }

  const taskId = await createTask(params);
  const sourceUrl = await waitForImage(taskId);

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new MagnificImageError(`Falha ao baixar a imagem gerada (${res.status})`);
  }

  const buffer = await sharp(Buffer.from(await res.arrayBuffer())).png().toBuffer();
  return { buffer, sourceUrl };
}
