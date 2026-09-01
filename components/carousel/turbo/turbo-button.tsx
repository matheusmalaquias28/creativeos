"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Zap, X, Loader2, ArrowLeft, Sparkles, Check, AlertCircle, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SlidePreview } from "@/components/carousel/slide-preview";
import { applyImageToSlide, type TurboSpec } from "@/lib/carousel/turbo/schema";
import type { CarouselDesign, CarouselSlide } from "@/types/carousel";

export type TurboProfile = {
  id: string;
  name: string;
  clientName: string | null;
  colors: string[];
  hasContext: boolean;
};

type Step = "profile" | "theme" | "review" | "building";

async function readSSE(res: Response, onEvent: (e: Record<string, unknown>) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {
        /* ignore */
      }
    }
  }
}

export function TurboButton({ profiles }: { profiles: TurboProfile[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("profile");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [theme, setTheme] = useState("");

  // content phase
  const [thinking, setThinking] = useState("");
  const [status, setStatus] = useState("");
  const [spec, setSpec] = useState<TurboSpec | null>(null);
  const [cardCount, setCardCount] = useState(6);
  const [contentLoading, setContentLoading] = useState(false);

  // build phase
  const [buildSlides, setBuildSlides] = useState<CarouselSlide[]>([]);
  const [buildDesign, setBuildDesign] = useState<CarouselDesign | null>(null);
  const [expected, setExpected] = useState<number[]>([]);
  const [received, setReceived] = useState<number[]>([]);
  const [imgProgress, setImgProgress] = useState<{ done: number; total: number } | null>(null);
  const [buildDone, setBuildDone] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const thinkRef = useRef<HTMLDivElement>(null);
  const savedIdRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);
  const doneRef = useRef(false);

  const selectedProfile = profiles.find((p) => p.id === profileId) ?? null;

  function reset() {
    setStep("profile");
    setProfileId(null);
    setTheme("");
    setThinking("");
    setStatus("");
    setSpec(null);
    setCardCount(6);
    setContentLoading(false);
    setBuildSlides([]);
    setBuildDesign(null);
    setExpected([]);
    setReceived([]);
    setImgProgress(null);
    setBuildDone(false);
    setError(null);
    savedIdRef.current = null;
    redirectedRef.current = false;
    doneRef.current = false;
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  function goToCarousel(id: string, watch = false, imgs?: number) {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const q = watch ? `?turbo=1${imgs ? `&imgs=${imgs}` : ""}` : "";
    router.push(`/carousel/${id}${q}`);
  }

  // ── Content generation (research → spec), re-runnable with a card count ──
  const fetchContent = useCallback(
    async (count?: number) => {
      if (!profileId || !theme.trim()) return;
      setContentLoading(true);
      setError(null);
      setThinking("");
      setStatus("Pesquisando o tema…");
      try {
        const res = await fetch("/api/carousel/turbo/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, theme: theme.trim(), cardCount: count }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Falha ao gerar o conteúdo");
        }
        await readSSE(res, (evt) => {
          switch (evt.type) {
            case "status":
              setStatus(String(evt.message ?? ""));
              break;
            case "text":
              setThinking((t) => t + String(evt.delta ?? ""));
              requestAnimationFrame(() =>
                thinkRef.current?.scrollTo({ top: thinkRef.current.scrollHeight })
              );
              break;
            case "spec": {
              const s = evt.spec as TurboSpec;
              setSpec(s);
              setCardCount(count ?? s.slides.length);
              break;
            }
            case "error":
              setError(String(evt.message ?? "Erro na geração"));
              break;
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro na geração");
      } finally {
        setContentLoading(false);
      }
    },
    [profileId, theme]
  );

  function startContent() {
    setStep("review");
    setSpec(null);
    fetchContent(undefined);
  }

  // ── Build (create + images live) ──
  async function startBuild() {
    if (!profileId || !spec) return;
    setStep("building");
    setError(null);
    setBuildSlides([]);
    setBuildDesign(null);
    setExpected([]);
    setReceived([]);
    setImgProgress(null);
    setBuildDone(false);
    savedIdRef.current = null;
    redirectedRef.current = false;
    doneRef.current = false;

    try {
      const res = await fetch("/api/carousel/turbo/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, spec, theme: theme.trim() }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao montar o carrossel");
      }
      await readSSE(res, handleBuildEvent);
    } catch (e) {
      if (savedIdRef.current) {
        toast.message("Conexão interrompida — abrindo o carrossel já salvo");
        goToCarousel(savedIdRef.current, true, imgProgress?.total);
        return;
      }
      setError(e instanceof Error ? e.message : "Erro ao montar");
      return;
    }

    if (!redirectedRef.current && savedIdRef.current && !doneRef.current) {
      // stream ended without explicit done — carousel exists, open it
      goToCarousel(savedIdRef.current, true, imgProgress?.total);
    }
  }

  function handleBuildEvent(evt: Record<string, unknown>) {
    switch (evt.type) {
      case "created": {
        const id = String(evt.carouselId);
        savedIdRef.current = id;
        setBuildSlides((evt.slides as CarouselSlide[]) ?? []);
        setBuildDesign((evt.design as CarouselDesign) ?? null);
        const exp = (evt.expected as number[]) ?? [];
        setExpected(exp);
        setReceived(exp.map(() => 0));
        const total = exp.reduce((a, b) => a + b, 0);
        setImgProgress({ done: 0, total });
        break;
      }
      case "image": {
        const si = Number(evt.si);
        const k = Number(evt.k);
        const url = evt.url ? String(evt.url) : null;
        if (url) {
          setBuildSlides((prev) => {
            const next = [...prev];
            const cur = next[si];
            if (cur) {
              const slide: CarouselSlide = {
                ...cur,
                imageGrid: cur.imageGrid
                  ? { ...cur.imageGrid, images: [...cur.imageGrid.images] }
                  : cur.imageGrid,
              };
              applyImageToSlide(slide, k, url);
              next[si] = slide;
            }
            return next;
          });
        }
        setReceived((prev) => {
          const n = [...prev];
          n[si] = (n[si] ?? 0) + 1;
          return n;
        });
        setImgProgress({ done: Number(evt.done ?? 0), total: Number(evt.total ?? 0) });
        break;
      }
      case "done": {
        const failed = Number(evt.imagesFailed ?? 0);
        const reason = evt.failReason ? String(evt.failReason) : "";
        doneRef.current = true;
        setBuildDone(true);
        if (failed > 0) {
          toast.warning(
            `${failed} imagem(ns) falharam${reason ? ` — ${reason}` : ""}. Gere-as no editor.`
          );
        } else {
          toast.success("Carrossel pronto!");
        }
        setTimeout(() => goToCarousel(String(evt.carouselId), false), 1400);
        break;
      }
      case "error":
        if (savedIdRef.current) goToCarousel(savedIdRef.current, true, imgProgress?.total);
        else setError(String(evt.message ?? "Erro"));
        break;
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 bg-positive text-positive-foreground hover:bg-positive/90 dark:shadow-[0_0_18px_-2px_var(--positive)]"
      >
        <Zap className="size-4" strokeWidth={2.5} />
        Gerador Turbo
      </Button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

            <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-positive/15 text-positive">
                    <Zap className="size-4" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight">Gerador Turbo</h2>
                    <p className="text-[0.65rem] text-muted-foreground">Geração guiada por IA</p>
                  </div>
                </div>
                <button onClick={close} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* Step 1 — profile */}
                {step === "profile" && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Para qual cliente vamos gerar?</p>
                    {profiles.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        Nenhum perfil cadastrado. Crie um perfil em <b>Perfis</b> (com cores e
                        contexto do cliente) para usar o Turbo.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {profiles.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setProfileId(p.id);
                              setStep("theme");
                            }}
                            className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-premium hover:border-primary/50 hover:bg-muted/40"
                          >
                            <div className="flex -space-x-1">
                              {p.colors.slice(0, 4).map((c, i) => (
                                <span key={i} className="size-6 rounded-full border-2 border-card" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{p.clientName ?? "Sem cliente"}</p>
                            </div>
                            {!p.hasContext && (
                              <span className="flex items-center gap-1 text-[0.6rem] text-warning">
                                <AlertCircle className="size-3" />
                                sem contexto
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2 — theme */}
                {step === "theme" && (
                  <div className="space-y-4">
                    <button onClick={() => setStep("profile")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="size-3.5" />
                      {selectedProfile?.name}
                    </button>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">O que vamos gerar hoje?</p>
                      <Textarea
                        autoFocus
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="Ex: 5 erros que travam as vendas do seu e-commerce em 2026"
                        rows={4}
                        className="resize-none text-sm"
                      />
                    </div>
                    <Button onClick={startContent} disabled={!theme.trim()} className="w-full gap-1.5 bg-positive text-positive-foreground hover:bg-positive/90">
                      <Sparkles className="size-4" />
                      Gerar conteúdo
                    </Button>
                  </div>
                )}

                {/* Step 3 — review */}
                {step === "review" && (
                  <div className="space-y-4">
                    <button onClick={() => setStep("theme")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="size-3.5" />
                      Trocar tema
                    </button>

                    {!spec ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Loader2 className="size-4 animate-spin text-positive" />
                          {status || "Pensando…"}
                        </div>
                        {thinking && (
                          <div ref={thinkRef} className="max-h-56 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3 text-[0.72rem] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {thinking}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Card count selector */}
                        <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">Quantidade de cards</span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              {contentLoading && <Loader2 className="size-3 animate-spin" />}
                              <b className="text-foreground">{cardCount}</b>
                            </span>
                          </div>
                          <input
                            type="range"
                            min={3}
                            max={10}
                            value={cardCount}
                            onChange={(e) => setCardCount(Number(e.target.value))}
                            disabled={contentLoading}
                            className="mt-2 w-full accent-positive"
                          />
                          {cardCount !== spec.slides.length ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 w-full gap-1.5 text-xs"
                              onClick={() => fetchContent(cardCount)}
                              disabled={contentLoading}
                            >
                              {contentLoading ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                              Confirmar {cardCount} cards e reescrever conteúdo
                            </Button>
                          ) : (
                            <p className="mt-1 text-[0.625rem] text-muted-foreground/60">
                              Ajuste o slider e confirme para a IA reescrever o conteúdo.
                            </p>
                          )}
                        </div>

                        {/* Content preview */}
                        <div className={cn("space-y-2", contentLoading && "opacity-50")}>
                          {spec.slides.map((s, i) => (
                            <div key={i} className="rounded-lg border border-border/40 bg-background/40 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6rem] font-bold text-muted-foreground">
                                  {i + 1}
                                </span>
                                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{s.titulo}</p>
                                <span className="shrink-0 text-[0.55rem] uppercase tracking-wider text-muted-foreground/50">{s.layout}</span>
                              </div>
                              {s.subtitulo && <p className="mt-1 pl-7 text-[0.7rem] leading-snug text-muted-foreground">{s.subtitulo}</p>}
                            </div>
                          ))}
                        </div>

                        <Button onClick={startBuild} disabled={contentLoading} className="w-full gap-1.5 bg-positive text-positive-foreground hover:bg-positive/90">
                          <Sparkles className="size-4" />
                          Aplicar e gerar imagens
                        </Button>
                      </>
                    )}

                    {error && (
                      <div className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-negative">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4 — building (live) */}
                {step === "building" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {buildDone ? (
                        <Check className="size-4 text-positive" />
                      ) : (
                        <Loader2 className="size-4 animate-spin text-positive" />
                      )}
                      {buildDone ? "Carrossel pronto — abrindo o editor…" : "Montando os cards e gerando as imagens…"}
                    </div>

                    {imgProgress && imgProgress.total > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[0.7rem] text-muted-foreground">
                          <span>Imagens</span>
                          <span>{imgProgress.done}/{imgProgress.total}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-positive transition-all" style={{ width: `${(imgProgress.done / imgProgress.total) * 100}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Live card grid */}
                    {buildSlides.length > 0 && buildDesign && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {buildSlides.map((slide, i) => {
                          const pending = (expected[i] ?? 0) > (received[i] ?? 0);
                          return (
                            <div key={slide.id} className="relative overflow-hidden rounded-lg ring-1 ring-white/8">
                              <SlidePreview
                                slide={slide}
                                format="carousel"
                                design={buildDesign}
                                index={i}
                                total={buildSlides.length}
                                previewWidth={130}
                              />
                              {pending && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 backdrop-blur-[1px]">
                                  <Loader2 className="size-4 animate-spin text-white/80" />
                                  <span className="flex items-center gap-1 text-[0.5rem] text-white/70">
                                    <ImageIcon className="size-2.5" />
                                    gerando
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {savedIdRef.current && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => goToCarousel(savedIdRef.current!, !doneRef.current, imgProgress?.total)}>
                        Abrir no editor agora
                      </Button>
                    )}

                    {error && (
                      <div className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 p-3 text-sm text-negative">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
