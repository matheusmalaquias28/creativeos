"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryGrid } from "@/components/image-library/library-grid";
import { addLibraryImageToArteAction, type ArteReference } from "@/actions/demand-references";
import {
  CATEGORY_META,
  REFERENCE_CATEGORIES,
  type ReferenceCategory,
} from "@/lib/image-library/categories";
import { filterLibraryImages } from "@/lib/image-library/search";
import { cn } from "@/lib/utils";
import type { LibraryImage } from "@/services/image-library";

// O acervo é carregado uma vez por sessão da página e reaproveitado entre as artes.
let libraryCache: LibraryImage[] | null = null;

export function LibraryPickerDialog({
  demandId,
  arteIndex,
  onClose,
  onAdded,
}: {
  demandId: string;
  /** Arte alvo; null fecha o dialog. */
  arteIndex: number | null;
  onClose: () => void;
  onAdded: (reference: ArteReference) => void;
}) {
  const open = arteIndex !== null;
  const [images, setImages] = useState<LibraryImage[] | null>(libraryCache);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LibraryImage | null>(null);
  const [category, setCategory] = useState<ReferenceCategory | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setCategory(null);

    let cancelled = false;
    fetch("/api/image-library")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Falha ao carregar o acervo");
        return body.images as LibraryImage[];
      })
      .then((list) => {
        if (cancelled) return;
        libraryCache = list;
        setImages(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Falha ao carregar o acervo");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const visible = useMemo(() => filterLibraryImages(images ?? [], query), [images, query]);

  function pick(image: LibraryImage) {
    setSelected(image);
    setCategory((current) => current ?? image.suggested_category ?? null);
  }

  function add() {
    if (arteIndex === null || !selected || !category) return;
    startTransition(async () => {
      const result = await addLibraryImageToArteAction({
        demandId,
        arteIndex,
        libraryImageId: selected.id,
        category,
      });
      if (result.error || !result.reference) {
        toast.error(result.error ?? "Falha ao adicionar");
        return;
      }
      toast.success(`Adicionada à arte ${arteIndex + 1} como ${CATEGORY_META[category].short}`);
      onAdded(result.reference);
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Acervo — arte {arteIndex !== null ? arteIndex + 1 : ""}</DialogTitle>
          <DialogDescription>
            Escolha uma imagem e diga como ela deve ser usada. Ela vai para o Space conectada a
            esta arte.
          </DialogDescription>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: balança, escritório, advogada, biblioteca…"
              className="pl-9"
              autoFocus
            />
          </div>
        </DialogHeader>

        <DialogBody>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : images === null ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              tone="slate"
              title="O acervo está vazio."
              description="Suba imagens na página Acervo para usá-las nas artes."
              action={
                <Link href="/acervo" className={buttonVariants({ size: "sm", variant: "outline" })}>
                  Abrir acervo
                </Link>
              }
            />
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nada encontrado para “{query}”.
            </p>
          ) : (
            <LibraryGrid images={visible} selectedId={selected?.id} onSelect={pick} />
          )}
        </DialogBody>

        <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {REFERENCE_CATEGORIES.map((value) => {
              const active = category === value;
              const suggested = selected?.suggested_category === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!selected || isPending}
                  onClick={() => setCategory(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-premium disabled:opacity-45",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-foreground hover:border-border-strong hover:bg-accent"
                  )}
                >
                  {active && <Check className="size-3" />}
                  {CATEGORY_META[value].label}
                  {suggested && !active && (
                    <span className="text-[0.625rem] text-muted-foreground">sugerida</span>
                  )}
                </button>
              );
            })}
          </div>
          <Button onClick={add} disabled={!selected || !category || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Adicionar à arte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
