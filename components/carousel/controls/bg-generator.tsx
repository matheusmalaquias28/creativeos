"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { withPtBrImagePrompt } from "@/lib/carousel/image-prompt";
import type { CarouselFormat } from "@/types/carousel";

const ASPECT_BY_FORMAT: Record<CarouselFormat, string> = {
  carousel: "4:5",
  square: "1:1",
  stories: "9:16",
};

const POLL_INTERVAL = 2500;
const MAX_POLLS = 48; // ~2 min

export function BackgroundGenerator({
  format,
  onApply,
}: {
  format: CarouselFormat;
  onApply: (url: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const cancelled = useRef(false);

  async function pollTask(taskId: string): Promise<string[]> {
    for (let i = 0; i < MAX_POLLS; i++) {
      if (cancelled.current) return [];
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const res = await fetch(`/api/gerador/task/${taskId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const status = String(data.status ?? "").toUpperCase();
      if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
        const urls = (data.generated as unknown[])
          .map((g) => {
            if (typeof g === "string") return g;
            const o = g as Record<string, string | undefined>;
            return o?.url ?? o?.image_url ?? o?.image ?? o?.output;
          })
          .filter(Boolean) as string[];
        return urls;
      }
      if (status === "FAILED" || status === "ERROR") {
        throw new Error("A geração falhou");
      }
    }
    throw new Error("Tempo esgotado na geração");
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Descreva a imagem de fundo");
      return;
    }
    setLoading(true);
    setResults([]);
    cancelled.current = false;
    try {
      const res = await fetch("/api/gerador/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: withPtBrImagePrompt(prompt.trim()),
          aspect_ratio: ASPECT_BY_FORMAT[format],
          resolution: "2K",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Erro ao iniciar geração");
      const urls = await pollTask(data.taskId);
      if (!urls.length) throw new Error("Nenhuma imagem retornada");
      setResults(urls);
      if (urls.length === 1) {
        onApply(urls[0]);
        toast.success("Fundo gerado e aplicado");
      } else {
        toast.success(`${urls.length} imagens geradas — clique para aplicar`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na geração");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
      <p className="text-[0.625rem] font-medium uppercase tracking-widest text-muted-foreground/60">
        Gerar fundo com IA · Nano Banana
      </p>
      <Textarea
        placeholder="Ex: gradiente abstrato roxo e azul, textura suave, cinematográfico"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="text-xs resize-none"
        rows={3}
      />
      <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleGenerate} disabled={loading}>
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {loading ? "Gerando..." : "Gerar fundo"}
      </Button>

      {results.length > 1 && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {results.map((url) => (
            <button
              key={url}
              onClick={() => { onApply(url); toast.success("Fundo aplicado"); }}
              className="overflow-hidden rounded-lg border border-border/40 transition-transform hover:scale-[1.02]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="fundo gerado" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
