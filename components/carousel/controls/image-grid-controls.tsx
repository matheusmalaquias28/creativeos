"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegenerateImageButton } from "@/components/carousel/controls/regenerate-image-button";
import { gridSlotAspect } from "@/lib/carousel/generate-image-client";
import {
  IMAGE_GRID_SLOTS,
  type CarouselImageGrid,
  type ImageGridLayout,
} from "@/types/carousel";

const LAYOUTS: { id: ImageGridLayout; label: string }[] = [
  { id: 1, label: "1 imagem" },
  { id: 2, label: "2 imagens" },
  { id: 3, label: "Mosaico" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Mini visual diagram of each layout. */
function LayoutDiagram({ layout }: { layout: ImageGridLayout }) {
  const cell = "rounded-sm bg-current";
  if (layout === 1) {
    return <div className={cn(cell, "h-full w-full")} />;
  }
  if (layout === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5">
        <div className={cell} />
        <div className={cell} />
      </div>
    );
  }
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
      <div className={cn(cell, "row-span-2")} />
      <div className={cell} />
      <div className={cell} />
    </div>
  );
}

export function ImageGridControls({
  grid,
  onChange,
}: {
  grid: CarouselImageGrid;
  onChange: (patch: Partial<CarouselImageGrid>) => void;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const slots = IMAGE_GRID_SLOTS[grid.layout];

  function setImage(index: number, url: string | null) {
    const images = [...(grid.images ?? [])];
    while (images.length < 3) images.push(null);
    images[index] = url;
    onChange({ images });
  }

  async function handleUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 10 MB)");
      return;
    }
    setUploading(index);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/gerador/upload-ref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Falha no upload");
      setImage(index, data.url);
      toast.success("Imagem adicionada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-xs font-medium text-foreground">Exibir grade de imagens</span>
        <input
          type="checkbox"
          checked={grid.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="size-4 accent-primary cursor-pointer"
        />
      </label>

      {grid.enabled && (
        <>
          {/* Layout */}
          <div className="space-y-1.5">
            <label className="text-[0.625rem] text-muted-foreground/70">Layout</label>
            <div className="grid grid-cols-3 gap-1.5">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onChange({ layout: l.id })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors",
                    grid.layout === l.id
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground/50 hover:bg-muted/40"
                  )}
                >
                  <div className="h-8 w-full">
                    <LayoutDiagram layout={l.id} />
                  </div>
                  <span className="text-[0.5625rem] font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Slots */}
          <div className="space-y-2">
            <label className="text-[0.625rem] text-muted-foreground/70">
              Imagens ({slots})
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: slots }).map((_, i) => {
                const url = grid.images?.[i] ?? null;
                const slotPrompt = grid.prompts?.[i] ?? null;
                return (
                  <div key={i} className="relative">
                    <label
                      className={cn(
                        "flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors",
                        url
                          ? "border-primary/40"
                          : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => handleUpload(i, e)}
                      />
                      {uploading === i ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="size-full object-cover" />
                      ) : (
                        <ImagePlus className="size-4" />
                      )}
                    </label>
                    {url && (
                      <button
                        onClick={() => setImage(i, null)}
                        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-negative text-white shadow"
                        title="Remover"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                    {slotPrompt && (
                      <RegenerateImageButton
                        variant="icon"
                        prompt={slotPrompt}
                        aspect={gridSlotAspect(grid.layout, i)}
                        onDone={(u) => setImage(i, u)}
                        className="absolute -left-1.5 -top-1.5"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[0.5625rem] leading-relaxed text-muted-foreground/50">
              A grade aparece no lado oposto ao texto: texto embaixo → imagens em
              cima, e vice-versa.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
