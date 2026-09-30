"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryGrid } from "@/components/image-library/library-grid";
import { CATEGORY_META } from "@/lib/image-library/categories";
import { filterLibraryImages } from "@/lib/image-library/search";
import type { LibraryImage } from "@/services/image-library";

const UPLOAD_CONCURRENCY = 3;

async function uploadOne(file: File): Promise<LibraryImage> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/image-library", { method: "POST", body: formData });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Falha no upload de ${file.name}`);
  if (body.annotationError) {
    toast.warning(`${file.name}: subiu, mas sem descrição automática (${body.annotationError})`);
  }
  return body.image as LibraryImage;
}

export function LibraryManager({ initialImages }: { initialImages: LibraryImage[] }) {
  const [images, setImages] = useState(initialImages);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(0);

  const visible = useMemo(() => filterLibraryImages(images, query), [images, query]);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setPending((n) => n + files.length);

    // A anotação por IA leva ~2s por imagem — sobe em paralelo limitado e
    // mostra cada uma assim que fica pronta.
    const queue = [...files];
    let ok = 0;
    async function worker() {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          const image = await uploadOne(file);
          setImages((prev) => [image, ...prev]);
          ok++;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Falha no upload de ${file.name}`);
        } finally {
          setPending((n) => n - 1);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));
    if (ok > 0) toast.success(`${ok} imagem(ns) adicionada(s) ao acervo`);
  }

  async function remove(image: LibraryImage) {
    if (!confirm("Remover esta imagem do acervo? Artes que já usam a imagem não são afetadas.")) return;
    setImages((prev) => prev.filter((i) => i.id !== image.id));
    const res = await fetch(`/api/image-library?id=${encodeURIComponent(image.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Falha ao remover");
      setImages((prev) => [image, ...prev]);
    }
  }

  return (
    <div className="space-y-5">
      <ImageDropzone
        multiple
        accept="image/jpeg,image/png,image/webp"
        onFiles={(files) => void uploadFiles(files)}
        isUploading={pending > 0}
        icon={<ImagePlus className="size-6 text-muted-foreground/60" strokeWidth={1.25} />}
        title={pending > 0 ? `Enviando e descrevendo ${pending} imagem(ns)…` : "Adicionar imagens ao acervo"}
        subtitle="JPEG, PNG ou WebP até 10MB. Cada imagem é descrita por IA para aparecer na busca."
        minHeight="sm"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no acervo"
            className="pl-9"
          />
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {query ? `${visible.length} de ${images.length}` : images.length} imagem(ns)
        </p>
      </div>

      {images.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          tone="amber"
          title="Acervo vazio"
          description="Suba fotos de advogados, escritórios, balanças, bibliotecas… e escolha em cada arte da demanda."
        />
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nada encontrado para “{query}”.</p>
      ) : (
        <LibraryGrid
          images={visible}
          className="lg:columns-5"
          renderOverlay={(image) => (
            <>
              <button
                type="button"
                onClick={() => void remove(image)}
                title="Remover do acervo"
                className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-lg border border-border bg-popover text-foreground opacity-0 shadow-[var(--surface-shadow)] transition-premium hover:bg-destructive hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Remover</span>
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100">
                {image.suggested_category && (
                  <span className="mb-1 inline-block rounded-md bg-white/15 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                    {CATEGORY_META[image.suggested_category].short}
                  </span>
                )}
                <p className="line-clamp-2 text-[0.6875rem] leading-snug text-white/90">
                  {image.annotation_status === "failed"
                    ? "Sem descrição automática"
                    : (image.ai_tags.join(" · ") || image.file_name)}
                </p>
                {image.usage_count > 0 && (
                  <p className="mt-0.5 text-[0.625rem] tabular-nums text-white/70">
                    usada {image.usage_count}×
                  </p>
                )}
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}
