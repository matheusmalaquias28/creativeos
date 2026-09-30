"use client";

import { useTransition } from "react";
import Image from "next/image";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteDemandReferenceAction,
  updateArteReferenceCategoryAction,
  type ArteReference,
} from "@/actions/demand-references";
import { CATEGORY_META, REFERENCE_CATEGORIES } from "@/lib/image-library/categories";

/**
 * Imagens do acervo ligadas a uma arte. Cada miniatura abre um menu para
 * trocar a categoria de uso ou remover a imagem da arte.
 */
export function ArteReferenceStrip({
  demandId,
  references,
  canAdd,
  onAdd,
  onChange,
}: {
  demandId: string;
  references: ArteReference[];
  canAdd: boolean;
  onAdd: () => void;
  /** Lista nova desta arte (após trocar categoria ou remover). */
  onChange: (next: ArteReference[]) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function changeCategory(ref: ArteReference, category: ArteReference["category"]) {
    if (ref.category === category) return;
    const previous = references;
    onChange(references.map((r) => (r.id === ref.id ? { ...r, category } : r)));
    startTransition(async () => {
      const result = await updateArteReferenceCategoryAction(demandId, ref.id, category);
      if (result.error) {
        toast.error(result.error);
        onChange(previous);
      }
    });
  }

  function remove(ref: ArteReference) {
    const previous = references;
    onChange(references.filter((r) => r.id !== ref.id));
    startTransition(async () => {
      const result = await deleteDemandReferenceAction(demandId, ref.id);
      if (result.error) {
        toast.error(result.error);
        onChange(previous);
      }
    });
  }

  if (references.length === 0 && !canAdd) return null;

  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {references.map((ref) => (
        <DropdownMenu key={ref.id}>
          <DropdownMenuTrigger
            disabled={isPending}
            title={`${CATEGORY_META[ref.category].label} — clique para alterar`}
            className="flex flex-col items-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="relative block size-9 overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={ref.storage_url}
                alt={ref.file_name}
                fill
                unoptimized
                className="object-cover"
                sizes="36px"
              />
            </span>
            <span className="max-w-12 truncate text-[0.5625rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_META[ref.category].short}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Usar como</DropdownMenuLabel>
              {REFERENCE_CATEGORIES.map((category) => (
                <DropdownMenuItem key={category} onClick={() => changeCategory(ref, category)}>
                  {ref.category === category ? <Check /> : <span className="size-4" />}
                  {CATEGORY_META[category].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => remove(ref)}>
              <Trash2 />
              Remover da arte
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          title="Adicionar imagem do acervo"
          className="mb-[0.875rem] inline-flex size-9 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-premium hover:border-primary/60 hover:text-primary"
        >
          <Plus className="size-3.5" />
          <span className="sr-only">Adicionar imagem do acervo</span>
        </button>
      )}
    </div>
  );
}
