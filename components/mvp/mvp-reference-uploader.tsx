"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Images, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { removeMvpReferenceAction, uploadMvpReferencesAction } from "@/actions/mvp";
import { SectionHeader } from "@/components/layout/section-header";
import { MVP_MAX_REFERENCES, type MvpReference } from "@/types/mvp";

type Props = {
  projectId: string;
  references: MvpReference[];
  disabled?: boolean;
};

/**
 * Referências visuais GERAIS do MVP (até 5) — na geração, todas são conectadas
 * em todos os nodes de imagem para manter a constância visual entre as páginas.
 */
export function MvpReferenceUploader({ projectId, references, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const remaining = MVP_MAX_REFERENCES - references.length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > remaining) {
      toast.error(`Máximo de ${MVP_MAX_REFERENCES} referências — restam ${remaining} vaga(s)`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);
    const result = await uploadMvpReferencesAction(projectId, {}, formData);
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (result.error) toast.error("Falha no upload", { description: result.error });
    else toast.success("Referências adicionadas");
  }

  function handleRemove(url: string) {
    startTransition(async () => {
      const result = await removeMvpReferenceAction(projectId, url);
      if (result.error) toast.error("Não foi possível remover", { description: result.error });
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--surface-shadow),var(--inner-highlight)]">
      <SectionHeader
        className="mb-4"
        icon={Images}
        tone="violet"
        title="Referências visuais do MVP"
        description={`Conectadas em todos os nodes de geração — até ${MVP_MAX_REFERENCES} imagens`}
        action={
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-bold text-muted-foreground tabular-nums">
            {references.length}/{MVP_MAX_REFERENCES}
          </span>
        }
      />
      <div className="flex flex-wrap gap-2">
        {references.map((ref) => (
          <div key={ref.url} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ref.url}
              alt={ref.fileName}
              className="size-16 rounded-xl border border-border object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(ref.url)}
                disabled={isPending}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border-2 border-card bg-tone-red text-background pointer-events-none opacity-0 shadow-[var(--surface-shadow)] transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 disabled:opacity-40"
                title="Remover referência"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex size-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong bg-surface text-[0.625rem] font-semibold text-muted-foreground transition-premium hover:border-primary/50 hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Adicionar referências"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <ImagePlus className="size-4" />
                Adicionar
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
