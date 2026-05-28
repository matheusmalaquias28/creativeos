const NANO_BANANA_API_BASE = "https://api.nanobananaapi.ai";
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 40; // 40 × 3s = 120s max

function getApiKey(): string {
  const key = process.env.NANO_BANANA_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NANO_BANANA_API_KEY não configurada em .env.local");
  return key;
}

type TaskRecord = {
  taskId: string;
  successFlag: 0 | 1 | 2 | 3;
  response?: {
    originImageUrl?: string;
    resultImageUrl?: string;
  };
  errorMessage?: string;
};

async function submitProTask(input: {
  prompt: string;
  imageUrls?: string[];
  resolution?: string;
  aspectRatio?: string;
}): Promise<string> {
  const body: Record<string, unknown> = { prompt: input.prompt };
  if (input.imageUrls?.length) body.imageUrls = input.imageUrls.slice(0, 8);
  if (input.resolution) body.resolution = input.resolution.toUpperCase();
  if (input.aspectRatio) body.aspectRatio = input.aspectRatio;

  const res = await fetch(`${NANO_BANANA_API_BASE}/api/v1/nanobanana/generate-pro`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json()) as {
    code: number;
    msg?: string;
    message?: string;
    data?: { taskId?: string };
  };

  if (!json.data?.taskId) {
    throw new Error(
      json.msg ?? json.message ?? `Nano Banana Pro erro (HTTP ${res.status}, code ${json.code}): ${JSON.stringify(json)}`
    );
  }
  return json.data.taskId;
}

async function pollTaskResult(taskId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `${NANO_BANANA_API_BASE}/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${getApiKey()}` },
        signal: AbortSignal.timeout(10_000),
      }
    );

    const json = (await res.json()) as {
      code: number;
      data?: TaskRecord;
    };

    const record = json.data;
    if (!record) continue;

    if (record.successFlag === 1) {
      const url = record.response?.resultImageUrl ?? record.response?.originImageUrl;
      if (!url) throw new Error("Nano Banana Pro: geração concluída mas sem URL de imagem");
      return url;
    }

    if (record.successFlag === 2 || record.successFlag === 3) {
      throw new Error(record.errorMessage ?? `Nano Banana Pro: falha na geração (flag ${record.successFlag})`);
    }
    // successFlag === 0 → ainda processando
  }

  throw new Error(`Nano Banana Pro: timeout após ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

export type NanoBananaProResult = {
  imageUrl: string;
  mimeType: string;
  model: string;
};

export async function generateNanoBananaProImage(input: {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  referenceUrls?: string[];
}): Promise<NanoBananaProResult> {
  const taskId = await submitProTask({
    prompt: input.prompt,
    imageUrls: input.referenceUrls?.length ? input.referenceUrls : undefined,
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
  });

  const imageUrl = await pollTaskResult(taskId);
  return { imageUrl, mimeType: "image/png", model: "nano-banana-pro" };
}
