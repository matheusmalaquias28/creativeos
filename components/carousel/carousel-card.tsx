"use client";

import Link from "next/link";
import { useState } from "react";
import { Layers, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FORMAT_LABELS } from "@/components/carousel/slide-preview";
import { deleteCarouselAction } from "@/actions/carousels";
import type { Carousel } from "@/types/carousel";

function formatRelativeDate(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days} dias atrás`;
}

function MiniSlideThumb({ carousel }: { carousel: Carousel }) {
  const first = carousel.slides[0];
  if (!first) return null;
  const bg = first.imagemFundo ? `url(${first.imagemFundo})` : first.corFundo;

  return (
    <div
      className="absolute inset-0 flex items-end p-4"
      style={{
        background: first.imagemFundo
          ? `linear-gradient(to top, ${first.corFundo}cc, transparent 60%), ${bg} center/cover`
          : first.corFundo,
      }}
    >
      <div className="truncate">
        {first.titulo && (
          <p
            className="truncate text-sm font-bold leading-tight"
            style={{ color: first.corTitulo }}
          >
            {first.titulo}
          </p>
        )}
        {first.subtitulo && (
          <p
            className="mt-0.5 truncate text-xs leading-tight"
            style={{ color: first.corSubtitulo }}
          >
            {first.subtitulo}
          </p>
        )}
      </div>
    </div>
  );
}

type CarouselCardProps = {
  carousel: Carousel;
};

export function CarouselCard({ carousel }: CarouselCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Deletar "${carousel.name}"?`)) return;
    setDeleting(true);
    const result = await deleteCarouselAction(carousel.id);
    if (result.error) {
      toast.error(result.error);
      setDeleting(false);
    } else {
      toast.success("Carrossel deletado");
    }
  }

  const aspectClass =
    carousel.format === "stories"
      ? "aspect-[9/16]"
      : carousel.format === "square"
        ? "aspect-square"
        : "aspect-[4/5]";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-premium hover-lift",
        "dark:border-white/7 dark:bg-card",
        deleting && "opacity-50 pointer-events-none"
      )}
    >
      {/* Thumbnail */}
      <Link href={`/carousel/${carousel.id}`}>
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-t-2xl bg-muted/30",
            aspectClass
          )}
          style={{ maxHeight: 220 }}
        >
          <MiniSlideThumb carousel={carousel} />
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/carousel/${carousel.id}`}>
              <p className="truncate text-sm font-medium text-foreground hover:text-primary transition-colors">
                {carousel.name}
              </p>
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {carousel.slides.length} slide
              {carousel.slides.length !== 1 ? "s" : ""} ·{" "}
              {formatRelativeDate(carousel.updated_at)}
            </p>
          </div>

          <div className="relative shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreVertical className="size-3.5" />
            </Button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-8 z-20 min-w-[9rem] rounded-xl border border-border bg-card p-1 shadow-xl dark:border-white/10 dark:bg-surface-elevated">
                  <Link
                    href={`/carousel/${carousel.id}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-muted/60"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDelete();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-negative hover:bg-negative/10"
                  >
                    <Trash2 className="size-3.5" />
                    Deletar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Badge variant="outline" className="text-[0.65rem]">
            <Layers className="mr-1 size-3" />
            {FORMAT_LABELS[carousel.format]}
          </Badge>
        </div>
      </div>
    </div>
  );
}
