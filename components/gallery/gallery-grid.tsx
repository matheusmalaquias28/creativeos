"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GeneratedImageRow } from "@/types/database";

const SOURCE_LABELS: Record<string, string> = {
  "carousel-turbo": "Carrossel Turbo",
  "carousel-editor": "Carrossel",
  gerador: "Gerador",
  artes: "Artes",
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
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex max-h-[95vh] max-w-[95vw] flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.prompt || "Imagem gerada"}
          className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        <div className="flex max-w-2xl flex-col items-center gap-2 text-center">
          {image.prompt && (
            <p className="line-clamp-2 text-xs text-white/60">{image.prompt}</p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadImage(image.url)}
              className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Download className="size-3.5" />
              Baixar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
              className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <X className="size-3.5" />
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function GalleryGrid({ images }: { images: GeneratedImageRow[] }) {
  const [fullscreen, setFullscreen] = useState<GeneratedImageRow | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/40 py-24 text-center dark:border-white/8">
        <ImageIcon className="size-8 text-muted-foreground/20" strokeWidth={1.25} />
        <div>
          <p className="text-sm text-muted-foreground/60">Nenhuma imagem gerada ainda</p>
          <p className="mt-0.5 text-xs text-muted-foreground/40">
            As imagens do Turbo, Gerador, carrosséis e artes aparecerão aqui
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground/60">
        {images.length} imagem{images.length !== 1 ? "ns" : ""}
      </p>

      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setFullscreen(img)}
            className={cn(
              "group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border border-border/50 bg-muted/10 text-left dark:border-white/8",
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

            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/45 via-transparent to-black/55 p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[0.6rem] font-medium text-white backdrop-blur-sm">
                  {SOURCE_LABELS[img.source] ?? img.source}
                </span>
                <span
                  role="button"
                  tabIndex={0}
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
                  className="flex size-6.5 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm hover:bg-black/80"
                >
                  <Download className="size-3.5" />
                </span>
              </div>
              <div>
                {img.prompt && (
                  <p className="line-clamp-2 text-[0.65rem] leading-snug text-white/85">
                    {img.prompt}
                  </p>
                )}
                <p className="mt-0.5 text-[0.6rem] text-white/50">
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
    </>
  );
}
