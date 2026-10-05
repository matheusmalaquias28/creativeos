"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, GalleryHorizontalEnd, Loader2, PenTool, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/layout/section-header";
import { Textarea } from "@/components/ui/textarea";
import { isStudioBusy, isStudioDocument, type StudioCarousel } from "@/types/carousel-studio";
import { FrameThumbnail } from "./frame-renderer";

const STATUS_LABEL: Record<StudioCarousel["status"], string> = {
  idle: "Aguardando geração",
  queued: "Na fila",
  generating: "Gerando",
  ready: "Pronto para revisar",
  failed: "Falhou",
};

/**
 * Seção "Carrossel Studio" da página de uma demanda do tipo carrossel.
 * Substitui o Space: mostra o progresso ao vivo, as páginas geradas e leva
 * ao editor.
 */
export function DemandStudioSection({ initial, hasClient }: { initial: StudioCarousel; hasClient: boolean }) {
  const [studio, setStudio] = useState(initial);
  const [brief, setBrief] = useState(initial.brief ?? "");
  const [showBrief, setShowBrief] = useState(false);
  const [starting, setStarting] = useState(false);
  const busy = isStudioBusy(studio.status);
  const doc = studio.document;

  const merge = useCallback((row: Partial<StudioCarousel>) => {
    setStudio((prev) => ({
      ...prev,
      ...row,
      document: row.document && isStudioDocument(row.document) ? row.document : prev.document,
    }));
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`studio-demand-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "studio_carousels", filter: `id=eq.${initial.id}` },
        (payload) => merge(payload.new as Partial<StudioCarousel>)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.id, merge]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/carousel/studio/${initial.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) merge((await res.json()).carousel);
    }, 5000);
    return () => clearInterval(timer);
  }, [busy, initial.id, merge]);

  const generate = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/carousel/studio/${initial.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível gerar");
      setStudio((s) => ({ ...s, status: "queued", generation: { stage: "queued", message: "Na fila…" } }));
      setShowBrief(false);
      toast.success("Gerando o carrossel — leva de 1 a 3 minutos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setStarting(false);
    }
  };

  const gen = studio.generation ?? {};
  const progress = gen.total ? Math.round(((gen.done ?? 0) / gen.total) * 100) : null;
  const hasPages = doc.pages.length > 0;

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={GalleryHorizontalEnd}
        tone="pink"
        title="Carrossel Studio"
        description="Gerado automaticamente com a ficha do cliente — fundo e elementos pela IA, textos e botões editáveis"
        action={
          <div className="flex items-center gap-2">
            {hasPages || busy ? (
              <Button variant="outline" size="sm" disabled={busy || starting} onClick={() => setShowBrief((v) => !v)}>
                <Sparkles />
                Gerar de novo
              </Button>
            ) : null}
            <Link href={`/carousel/studio/${studio.id}`} className={buttonVariants({ size: "sm" })}>
              <PenTool />
              Abrir editor
            </Link>
          </div>
        }
      />
      <Surface padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium">
            {busy ? <Loader2 className="size-4 animate-spin text-tone-pink" /> : null}
            {STATUS_LABEL[studio.status]}
          </span>
          {busy && gen.message ? <span className="text-muted-foreground">{gen.message}</span> : null}
          {studio.status === "failed" && gen.error ? (
            <span className="inline-flex items-center gap-1.5 text-tone-red">
              <AlertTriangle className="size-4" />
              {gen.error}
            </span>
          ) : null}
          {studio.status === "ready" && gen.error ? <span className="text-xs text-tone-amber">{gen.error}</span> : null}
        </div>

        {busy && progress !== null ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-tone-pink transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
        ) : null}

        {hasPages ? (
          <Link href={`/carousel/studio/${studio.id}`} className="block">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {doc.pages.map((page) => (
                <FrameThumbnail
                  key={page.id}
                  page={page}
                  width={doc.width}
                  height={doc.height}
                  displayWidth={180}
                  className="shrink-0 rounded-lg ring-1 ring-border transition hover:ring-2 hover:ring-tone-pink"
                />
              ))}
            </div>
          </Link>
        ) : !busy ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5">
            <p className="text-sm text-muted-foreground">
              {hasClient
                ? "Este carrossel ainda não foi gerado. A IA lê a ficha do cliente (logo, cores, DNA visual e referências), o briefing de cada arte e as referências desta demanda."
                : "Vincule esta demanda a um cliente para o Studio puxar logo, cores e referências — a geração começa sozinha ao vincular."}
            </p>
            {hasClient ? (
              <Button size="sm" onClick={() => setShowBrief(true)} disabled={starting}>
                <Sparkles />
                Gerar carrossel
              </Button>
            ) : null}
          </div>
        ) : null}

        {showBrief ? (
          <div className="space-y-2 rounded-xl border border-border bg-surface/60 p-4">
            <label className="text-sm font-medium">Instrução para a IA (opcional)</label>
            <Textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Ex.: estilo mais clean, fundos claros, fotos de pessoas reais, títulos gigantes…"
            />
            <p className="text-xs text-muted-foreground">
              Referências novas desta demanda? Suba em “Logo e referências” abaixo (ou no editor) antes de gerar.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={generate} disabled={starting}>
                {starting ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {hasPages ? "Gerar de novo (substitui o atual)" : "Gerar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowBrief(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {studio.caption && studio.status === "ready" ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Legenda sugerida</summary>
            <p className="mt-2 whitespace-pre-wrap text-foreground/90">{studio.caption}</p>
          </details>
        ) : null}
      </Surface>
    </section>
  );
}
