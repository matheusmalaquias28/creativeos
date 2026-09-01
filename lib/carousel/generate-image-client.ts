import type { CarouselFormat, ImageGridLayout } from "@/types/carousel";

/** Aspect ratio per carousel format (backgrounds). Client-safe. */
export const FORMAT_ASPECT: Record<CarouselFormat, string> = {
  carousel: "4:5",
  square: "1:1",
  stories: "9:16",
};

/** Aspect ratio that matches each grid cell (mirrors the Turbo server logic). */
export function gridSlotAspect(layout: ImageGridLayout, k: number): string {
  if (layout === 1) return "4:3";
  if (layout === 2) return "3:4";
  return k === 0 ? "3:4" : "4:3"; // layout 3
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL = 2500;
const MAX_POLLS = 48;

/**
 * Generate one image from a prompt via the Gerador (Magnific) endpoints and
 * return its URL. Throws with a readable reason on failure.
 */
export async function generateImageViaGerador(
  prompt: string,
  aspect: string
): Promise<string> {
  const res = await fetch("/api/gerador/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: aspect, resolution: "2K" }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Erro ao iniciar a geração");
  const taskId = data.taskId;
  if (!taskId) throw new Error("Sem task_id");

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL);
    const r = await fetch(`/api/gerador/task/${taskId}`, { cache: "no-store" });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const status = String(d.status ?? "").toUpperCase();
    if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
      const urls = (d.generated as unknown[])
        .map((g) => {
          if (typeof g === "string") return g;
          const o = g as Record<string, string | undefined>;
          return o?.url ?? o?.image_url ?? o?.image ?? o?.output;
        })
        .filter(Boolean) as string[];
      if (urls[0]) return urls[0];
      throw new Error("Resultado sem imagem");
    }
    if (status === "FAILED" || status === "ERROR") throw new Error("A geração falhou");
  }
  throw new Error("Tempo esgotado na geração");
}
