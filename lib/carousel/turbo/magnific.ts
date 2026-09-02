import type { CarouselFormat } from "@/types/carousel";

const MAGNIFIC_API = "https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro";
const POLL_INTERVAL = 2500;
const MAX_POLLS = 32; // ~80s per image

export const ASPECT_BY_FORMAT: Record<CarouselFormat, string> = {
  carousel: "4:5",
  square: "1:1",
  stories: "9:16",
};

export type MagnificResult = { url: string | null; reason?: string };

/** Referência visual passada ao Magnific para guiar o estilo da imagem. */
export type MagnificReference = { url: string; mimeType?: string; text?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mimeFromUrl(url: string): "image/png" | "image/jpeg" | "image/webp" {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Generate a single image from a prompt via Magnific; returns its URL or a reason. */
export async function generateMagnificImage(
  prompt: string,
  aspect: string,
  references?: MagnificReference[]
): Promise<MagnificResult> {
  const key = process.env.MAGNIFIC_API_KEY;
  if (!key) return { url: null, reason: "MAGNIFIC_API_KEY não configurada" };
  if (!prompt.trim()) return { url: null, reason: "prompt vazio" };

  try {
    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      aspect_ratio: aspect,
      resolution: "2K",
    };
    if (references && references.length > 0) {
      payload.reference_images = references.slice(0, 4).map((r) => ({
        image: r.url,
        mime_type: r.mimeType ?? mimeFromUrl(r.url),
        text: r.text ?? "Use como referência de estilo visual, cores e composição do fundo",
      }));
    }
    const res = await fetch(MAGNIFIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-magnific-api-key": key },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = `Magnific ${res.status}: ${data?.message ?? "erro ao criar task"}`;
      console.error("[turbo] magnific create failed", reason);
      return { url: null, reason };
    }
    const taskId = data?.data?.task_id;
    if (!taskId) return { url: null, reason: "Magnific não retornou task_id" };

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL);
      const r = await fetch(`${MAGNIFIC_API}/${taskId}`, {
        headers: { "x-magnific-api-key": key },
        cache: "no-store",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const reason = `Magnific poll ${r.status}`;
        console.error("[turbo] magnific poll failed", reason);
        return { url: null, reason };
      }
      const status = String(d?.data?.status ?? "").toUpperCase();
      if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
        const gen = (d?.data?.generated ?? []) as unknown[];
        for (const g of gen) {
          if (typeof g === "string") return { url: g };
          const o = g as Record<string, string | undefined>;
          const url = o?.url ?? o?.image_url ?? o?.image ?? o?.output;
          if (url) return { url };
        }
        return { url: null, reason: "resultado sem imagem" };
      }
      if (status === "FAILED" || status === "ERROR") {
        const reason = `Magnific: ${d?.data?.error ?? "geração falhou"}`;
        console.error("[turbo] magnific task failed", reason);
        return { url: null, reason };
      }
    }
    return { url: null, reason: "tempo esgotado na imagem (Magnific demorou demais)" };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erro de rede";
    console.error("[turbo] magnific exception", reason);
    return { url: null, reason };
  }
}
