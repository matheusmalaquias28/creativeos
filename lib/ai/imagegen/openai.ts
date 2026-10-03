/**
 * Geração de imagem pela API da OpenAI (GPT Image 2.5).
 *
 * Mesmo contrato dos outros providers (ver magnific.ts): prompt + referências
 * por URL → PNG em Buffer. É o provider padrão do "Spaces" próprio, escolhido
 * por `IMAGE_PROVIDER=openai` em provider.ts.
 *
 * GPT Image 2.5 aceita DIMENSÕES CUSTOM (`WIDTHxHEIGHT`): múltiplos de 16,
 * aspect entre 1:3 e 3:1, borda ≤ 3840px e total de pixels entre 655.360 e
 * 8.294.400. Então os formatos do produto (4:5, 9:16, 1:1, 3:4…) saem nativos e
 * o "1k/2k/4k" vira uma faixa de total de pixels calculada por aspect
 * (`resolveDimensions`). A qualidade (low/medium/high) vai direto no `quality`.
 *
 * Referências entram pelo endpoint de edição (`/images/edits`, multipart, campo
 * `image[]`): baixamos cada URL e mandamos como arquivo — a OpenAI não aceita
 * URL remota para gpt-image. Sem referências, usamos `/images/generations`
 * (JSON). Em ambos o retorno é `b64_json` (URL não é suportada para gpt-image).
 */

import sharp from "sharp";

const OPENAI_API = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-image-2.5-sunburst";
/** Teto defensivo de referências por chamada (evita payload gigante). */
const MAX_REFERENCES = 8;

export class OpenAIImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIImageError";
  }
}

export type OpenAIReference = {
  url: string;
  /** Papel desta imagem — anexado ao prompt como contexto. */
  text?: string | null;
};

export type OpenAIImageQuality = "low" | "medium" | "high" | "xhigh" | "max";

export type OpenAIImageParams = {
  prompt: string;
  references?: OpenAIReference[];
  /** "4:5" | "9:16" | "1:1" | "3:4" | "16:9" … */
  aspectRatio?: string;
  /** "1K" | "2K" | "4K" — faixa de total de pixels. */
  resolution?: string;
  quality?: OpenAIImageQuality;
};

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new OpenAIImageError("OPENAI_API_KEY não configurada");
  return key;
}

function model(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
}

// Limites de dimensão do gpt-image-2.5 (ver doc OpenAI).
const EDGE_MAX = 3840;
const PIXELS_MIN = 655_360;
const PIXELS_MAX = 8_294_400;
const STEP = 16;

/** Total de pixels alvo por faixa de resolução. */
const RESOLUTION_BUDGET: Record<string, number> = {
  "1K": 1_100_000,
  "2K": 2_200_000,
  "4K": 4_200_000,
};

function roundToStep(n: number): number {
  return Math.max(STEP, Math.round(n / STEP) * STEP);
}

function parseAspect(aspectRatio: string | undefined): number {
  const [w, h] = (aspectRatio ?? "1:1").split(":").map((p) => Number(p.trim()));
  if (!w || !h || w <= 0 || h <= 0) return 1;
  return w / h;
}

/**
 * Converte aspect + faixa (1K/2K/4K) numa string `WIDTHxHEIGHT` válida para o
 * gpt-image-2.5: múltiplos de 16, aspect dentro de 1:3..3:1, borda ≤ 3840 e
 * total de pixels em [655.360, 8.294.400]. Resolve a partir de um total-alvo e
 * ajusta para caber nos limites sem distorcer o aspect de forma perceptível.
 */
export function resolveDimensions(
  aspectRatio: string | undefined,
  resolution: string | undefined
): { size: string; width: number; height: number } {
  // aspect clampado para a janela suportada (1:3 .. 3:1)
  const ratio = Math.min(3, Math.max(1 / 3, parseAspect(aspectRatio)));
  let target = RESOLUTION_BUDGET[(resolution ?? "2K").toUpperCase()] ?? RESOLUTION_BUDGET["2K"];
  target = Math.min(PIXELS_MAX, Math.max(PIXELS_MIN, target));

  // h = sqrt(T / ratio); w = ratio * h  (ratio = w/h)
  let height = roundToStep(Math.sqrt(target / ratio));
  let width = roundToStep(ratio * height);

  // Clampa bordas ao máximo preservando o aspect o quanto der.
  if (width > EDGE_MAX) {
    width = EDGE_MAX;
    height = roundToStep(width / ratio);
  }
  if (height > EDGE_MAX) {
    height = EDGE_MAX;
    width = roundToStep(ratio * height);
  }

  // Garante o piso de pixels (aspects extremos no 1K podem ficar abaixo).
  let guard = 0;
  while (width * height < PIXELS_MIN && guard++ < 8) {
    height = roundToStep(height + STEP);
    width = roundToStep(ratio * height);
  }

  width = Math.max(STEP, Math.min(EDGE_MAX, width));
  height = Math.max(STEP, Math.min(EDGE_MAX, height));

  return { size: `${width}x${height}`, width, height };
}

function mimeFromUrl(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function downloadReference(url: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new OpenAIImageError(`Falha ao baixar referência (${res.status}): ${url}`);
  }
  const mime = mimeFromUrl(url);
  const bytes = Buffer.from(await res.arrayBuffer());
  return { blob: new Blob([bytes], { type: mime }), filename: `ref.${extFromMime(mime)}` };
}

/** Compõe o prompt final anexando o papel de cada referência, quando houver. */
function composePrompt(params: OpenAIImageParams): string {
  const base = params.prompt.trim();
  const roles = (params.references ?? [])
    .map((r, i) => (r.text?.trim() ? `Imagem ${i + 1}: ${r.text.trim()}` : null))
    .filter((v): v is string => v !== null);
  if (roles.length === 0) return base;
  return `${base}\n\nReferências anexadas:\n${roles.join("\n")}`;
}

function decodeFirstImage(data: unknown): Buffer {
  const list = (data as { data?: { b64_json?: string }[] })?.data ?? [];
  const b64 = list[0]?.b64_json;
  if (!b64) throw new OpenAIImageError("Resposta da OpenAI sem imagem (b64_json)");
  return Buffer.from(b64, "base64");
}

/**
 * Gera uma imagem e devolve os bytes em PNG — igual aos outros providers, todo
 * o resto do pipeline (composição de logo, revisão, upload) trabalha com Buffer.
 */
export async function generateOpenAIImage(
  params: OpenAIImageParams
): Promise<{ buffer: Buffer }> {
  if (!params.prompt?.trim()) throw new OpenAIImageError("Prompt vazio");

  const { size } = resolveDimensions(params.aspectRatio, params.resolution);
  const quality = params.quality ?? "medium";
  const prompt = composePrompt(params);
  const refs = (params.references ?? []).slice(0, MAX_REFERENCES);

  let payload: unknown;

  if (refs.length > 0) {
    // Edição multipart com uma ou mais referências (`image[]`).
    const form = new FormData();
    form.append("model", model());
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");
    for (const ref of refs) {
      const { blob, filename } = await downloadReference(ref.url);
      form.append("image[]", blob, filename);
    }

    const res = await fetch(`${OPENAI_API}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    });
    payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new OpenAIImageError(
        `OpenAI ${res.status}: ${(payload as { error?: { message?: string } })?.error?.message ?? "erro na edição"}`
      );
    }
  } else {
    // Geração text-to-image (JSON).
    const res = await fetch(`${OPENAI_API}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({ model: model(), prompt, size, quality, n: 1 }),
    });
    payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new OpenAIImageError(
        `OpenAI ${res.status}: ${(payload as { error?: { message?: string } })?.error?.message ?? "erro na geração"}`
      );
    }
  }

  const buffer = await sharp(decodeFirstImage(payload)).png().toBuffer();
  return { buffer };
}
