"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LibraryImage } from "@/services/image-library";

/** Grid masonry (colunas CSS) — respeita a proporção de cada imagem. */
export function LibraryGrid({
  images,
  selectedId,
  onSelect,
  renderOverlay,
  className,
}: {
  images: LibraryImage[];
  selectedId?: string | null;
  onSelect?: (image: LibraryImage) => void;
  renderOverlay?: (image: LibraryImage) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("columns-2 gap-3 sm:columns-3 lg:columns-4", className)}>
      {images.map((image) => {
        const selected = selectedId === image.id;
        const content = (
          <>
            <Image
              src={image.storage_url}
              alt={image.ai_description ?? image.file_name ?? "Imagem do acervo"}
              width={image.width ?? 400}
              height={image.height ?? 400}
              unoptimized
              loading="lazy"
              className="h-auto w-full"
            />
            {renderOverlay?.(image)}
          </>
        );

        return (
          <div
            key={image.id}
            className={cn(
              "group relative mb-3 break-inside-avoid overflow-hidden rounded-xl border bg-muted transition-premium",
              selected
                ? "border-primary ring-2 ring-primary/40"
                : "border-border hover:border-border-strong"
            )}
            title={image.ai_description ?? image.file_name ?? undefined}
          >
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(image)}
                className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-pressed={selected}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
