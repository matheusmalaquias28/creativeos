"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { GeneratedImageRow } from "@/types/database";

const SOURCE_LABELS: Record<string, string> = {
  "carousel-turbo": "Carrossel Turbo",
  "carousel-editor": "Carrossel",
  gerador: "Gerador",
  artes: "Artes",
};

/** Tom do chip de origem (pink/violet = geração por IA). */
const SOURCE_TONES: Record<string, "pink" | "violet" | "cyan" | "orange"> = {
  "carousel-turbo": "pink",
  "carousel-editor": "violet",
  gerador: "pink",
  artes: "orange",
};

/** Alturas alternadas (estilo bento) — cicla conforme a posição na galeria. */
const BENTO_ASPECTS = [
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[2/3]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[3/5]",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function downloadImage(url: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `galeria-${Date.now()}.jpg`;
  a.click();
}

function FullscreenViewer({
  image,
  onClose,
}: {
  image: GeneratedImageRow;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.prompt || "Imagem gerada"}
      className="animate-in-soft fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 p-4 backdrop-blur-xl"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[95vh] max-w-[95vw] flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.prompt || "Imagem gerada"}
          className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-[var(--surface-shadow-elevated)] ring-1 ring-border"
        />
        <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant={SOURCE_TONES[image.source] ?? "slate"}>
              {SOURCE_LABELS[image.source] ?? image.source}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(image.created_at)}
            </span>
          </div>
          {image.prompt && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {image.prompt}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => downloadImage(image.url)}>
              <Download />
              Baixar
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X />
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

type SourceFilter = "all" | string;

export function GalleryGrid({ images }: { images: GeneratedImageRow[] }) {
  const [fullscreen, setFullscreen] = useState<GeneratedImageRow | null>(null);
  const [filter, setFilter] = useState<SourceFilter>("all");

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const img of images) counts.set(img.source, (counts.get(img.source) ?? 0) + 1);
    return counts;
  }, [images]);

  const visible = useMemo(
    () => (filter === "all" ? images : images.filter((img) => img.source === filter)),
    [images, filter]
  );

  if (images.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        tone="pink"
        title="Nenhuma imagem gerada ainda"
        description="As imagens do Turbo, Gerador, carrosséis e artes aparecerão aqui."
        className="py-24"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {sourceCounts.size > 1 ? (
          <SegmentedControl<SourceFilter>
            aria-label="Filtrar por origem"
            size="sm"
            value={filter}
            onChange={setFilter}
            className="max-w-full overflow-x-auto"
            options={[
              { value: "all", label: "Todas", count: images.length },
              ...Array.from(sourceCounts.entries()).map(([source, count]) => ({
                value: source,
                label: SOURCE_LABELS[source] ?? source,
                count,
              })),
            ]}
          />
        ) : (
          <span />
        )}
        <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
          {visible.length} imagem{visible.length !== 1 ? "ns" : ""}
        </p>
      </div>

      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 2xl:columns-5">
        {visible.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setFullscreen(img)}
            className={cn(
              "group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-[var(--surface-shadow)] outline-none transition-premium hover:border-border-strong hover:shadow-[var(--surface-shadow-hover)] focus-visible:ring-2 focus-visible:ring-ring/50",
              BENTO_ASPECTS[i % BENTO_ASPECTS.length]
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.prompt || "Imagem gerada"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />

            {/* Overlay (scrim para legibilidade sobre a foto) */}
            <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-background/70 via-transparent to-background/85 p-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <div className="flex items-start justify-between gap-2">
                <Badge variant={SOURCE_TONES[img.source] ?? "slate"} className="bg-popover/90">
                  {SOURCE_LABELS[img.source] ?? img.source}
                </Badge>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Baixar imagem"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(img.url);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      downloadImage(img.url);
                    }
                  }}
                  className="flex size-7 items-center justify-center rounded-lg border border-border bg-popover/90 text-foreground transition-colors hover:bg-accent"
                >
                  <Download className="size-3.5" />
                </span>
              </div>
              <div>
                {img.prompt && (
                  <p className="line-clamp-2 text-[0.6875rem] leading-snug font-medium text-foreground">
                    {img.prompt}
                  </p>
                )}
                <p className="mt-0.5 text-[0.625rem] text-muted-foreground">
                  {formatDate(img.created_at)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {fullscreen && (
        <FullscreenViewer image={fullscreen} onClose={() => setFullscreen(null)} />
      )}
    </div>
  );
}
