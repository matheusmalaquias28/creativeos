"use client";

import Image from "next/image";
import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LightboxItem = {
  url: string;
  label: string;
  downloadName?: string;
};

type Props = {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

/**
 * Visualizador em tela cheia. A arte é 3:4 e `object-contain` — numa tela de
 * aprovação, cortar a imagem para preencher esconde exatamente o que se está
 * conferindo.
 */
export function ImageLightbox({ items, index, onClose, onNavigate }: Props) {
  const open = index !== null && index >= 0 && index < items.length;
  const current = open ? items[index] : null;

  const go = useCallback(
    (delta: number) => {
      if (index === null || items.length === 0) return;
      onNavigate((index + delta + items.length) % items.length);
    },
    [index, items.length, onNavigate]
  );

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }

    document.addEventListener("keydown", onKey);
    // Trava o scroll do fundo enquanto a arte está aberta.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, go]);

  const handleDownload = useCallback(() => {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = current.downloadName ?? `${current.label}.png`;
    a.target = "_blank";
    a.click();
  }, [current]);

  if (!open || !current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.label}
      className="animate-in-soft fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="text-sm text-muted-foreground">
          {current.label}
          {items.length > 1 && (
            <span className="ml-2 font-mono text-xs">
              {(index ?? 0) + 1}/{items.length}
            </span>
          )}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            aria-label="Baixar arte"
            className="transition-premium rounded-lg p-2 text-muted-foreground hover:bg-white/8 hover:text-foreground"
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="transition-premium rounded-lg p-2 text-muted-foreground hover:bg-white/8 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-6">
        {items.length > 1 && (
          <NavButton
            side="left"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          />
        )}

        <div
          className="relative h-full w-full max-w-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={current.url}
            alt={current.label}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-contain"
            priority
          />
        </div>

        {items.length > 1 && (
          <NavButton
            side="right"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          />
        )}
      </div>
    </div>
  );
}

function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Arte anterior" : "Próxima arte"}
      className={cn(
        "transition-premium absolute top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/80 p-2.5 text-muted-foreground backdrop-blur",
        "hover:text-foreground dark:border-white/10",
        side === "left" ? "left-2" : "right-2"
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
