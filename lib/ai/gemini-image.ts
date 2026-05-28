import { buildGeminiImagePromptText } from "@/lib/ai/gemini-prompt-text";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const SUPPORTED_ASPECT_RATIOS = new Set([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
]);

export type GeminiReferenceImage = {
  mimeType: string;
  base64: string;
  label: string;
};

export type GenerateGeminiImageInput = {
  promptPayload: Record<string, unknown>;
  aspectRatio?: string;
  quality?: string;
  referenceImages?: GeminiReferenceImage[];
};

export type GenerateGeminiImageResult = {
  imageBase64: string;
  mimeType: string;
  model: string;
};

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Adicione sua chave de teste do Nano Banana em .env.local"
    );
  }
  return key;
}

export function getGeminiImageModel(): string {
  return (
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image"
  );
}

export function normalizeAspectRatio(ratio?: string): string {
  if (!ratio) return "1:1";
  const cleaned = ratio.trim().replace(/\s+/g, "");
  if (SUPPORTED_ASPECT_RATIOS.has(cleaned)) return cleaned;
  const match = cleaned.match(/^(\d+)\s*[:/]\s*(\d+)$/);
  if (match) {
    const normalized = `${match[1]}:${match[2]}`;
    if (SUPPORTED_ASPECT_RATIOS.has(normalized)) return normalized;
  }
  return "1:1";
}

export async function generateGeminiImage(
  input: GenerateGeminiImageInput
): Promise<GenerateGeminiImageResult> {
  const apiKey = getGeminiApiKey();
  const model = getGeminiImageModel();
  const aspectRatio = normalizeAspectRatio(input.aspectRatio);
  const promptText = buildGeminiImagePromptText(input.promptPayload, input.quality);

  const parts: Array<Record<string, unknown>> = [];

  for (const ref of input.referenceImages ?? []) {
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.base64,
      },
    });
  }

  parts.push({ text: promptText });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
      },
    },
  };

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
  };

  if (!res.ok) {
    const msg =
      json.error?.message ?? `Gemini API error (${res.status})`;
    throw new Error(msg);
  }

  const responseParts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of responseParts) {
    const inline = part.inlineData ?? part.inline_data;
    const data = inline?.data;
    if (data) {
      const mimeType =
        (part.inlineData?.mimeType ??
          part.inline_data?.mime_type ??
          "image/png") as string;
      return { imageBase64: data, mimeType, model };
    }
  }

  const textPart = responseParts.find((p) => p.text)?.text;
  throw new Error(
    textPart
      ? `Gemini não retornou imagem: ${textPart.slice(0, 200)}`
      : "Gemini não retornou imagem na resposta"
  );
}
