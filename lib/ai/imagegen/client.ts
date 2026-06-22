import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromText,
  type Chat,
  type Content,
  type Part,
} from "@google/genai";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image";

/** Nomes comerciais → IDs aceitos pela Gemini API. */
const IMAGE_MODEL_ALIASES: Record<string, string> = {
  "nano banana pro": "gemini-3-pro-image",
  "nano banana pro 2": "gemini-3-pro-image",
  "nano-banana-pro": "gemini-3-pro-image",
  "nano banana 2": "gemini-3.1-flash-image",
  "nano-banana-2": "gemini-3.1-flash-image",
};

function resolveImageModel(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_IMAGE_MODEL;

  const alias = IMAGE_MODEL_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  if (/\s/.test(trimmed)) {
    console.warn(
      `[imagegen] IMAGE_MODEL="${trimmed}" não é um ID Gemini válido (use ex: gemini-3-pro-image). ` +
        `Caindo no padrão ${DEFAULT_IMAGE_MODEL}.`
    );
    return DEFAULT_IMAGE_MODEL;
  }

  return trimmed;
}

/** Lê IMAGE_MODEL a cada chamada (evita cache do valor antigo sem restart). */
export function getImageModel(): string {
  return resolveImageModel(process.env.IMAGE_MODEL);
}

/** @deprecated Prefer getImageModel() — mantido para compatibilidade. */
export const IMAGE_MODEL = getImageModel();

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageSize = "1K" | "2K" | "4K";
export type AspectRatio = "1:1" | "4:5" | "16:9" | "9:16" | "4:3" | "3:4";

export type InlineDataPart = {
  inlineData: { mimeType: string; data: string };
};

// Re-export SDK Part for convenience
export type { Part };

export type GenerateArtParams = {
  prompt: string;
  references?: InlineDataPart[];
  imageSize?: ImageSize;
  aspectRatio?: AspectRatio;
};

export type GenerateArtResult = {
  base64: string;
  mimeType: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("500") ||
    msg.includes("503") ||
    msg.includes("unavailable")
  );
}

function extractImagePart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidates: any[]
): GenerateArtResult {
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }
  }
  throw new Error("No image part found in Gemini response");
}

// ---------------------------------------------------------------------------
// generateArt — single generation (síncrona, sem webhook/polling)
// ---------------------------------------------------------------------------

export async function generateArt(
  params: GenerateArtParams
): Promise<GenerateArtResult> {
  const { prompt, references = [], imageSize = "2K", aspectRatio = "1:1" } =
    params;
  const client = getClient();

  const parts: Part[] = [
    ...references.map((r) =>
      createPartFromBase64(r.inlineData.data, r.inlineData.mimeType)
    ),
    createPartFromText(prompt),
  ];

  const contents: Content[] = [{ role: "user", parts }];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: getImageModel(),
        contents,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            imageSize,
            aspectRatio,
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return extractImagePart((response as any).candidates ?? []);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isRetryable(error) && attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("generateArt: max retries exceeded");
}

// ---------------------------------------------------------------------------
// Chat sessions for multi-turn edit (SDK gerencia thought signatures)
// ---------------------------------------------------------------------------

export function createArtEditSession(): Chat {
  const client = getClient();
  return client.chats.create({
    model: getImageModel(),
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });
}

export async function editArtInSession(
  session: Chat,
  currentImageBase64: string,
  currentMimeType: string,
  instruction: string,
  imageSize: ImageSize = "2K",
  aspectRatio: AspectRatio = "1:1"
): Promise<GenerateArtResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await session.sendMessage({
        message: [
          {
            inlineData: { mimeType: currentMimeType, data: currentImageBase64 },
          },
          { text: instruction },
        ],
        config: {
          imageConfig: { imageSize, aspectRatio },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return extractImagePart((response as any).candidates ?? []);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isRetryable(error) && attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("editArtInSession: max retries exceeded");
}
