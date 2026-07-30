"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { removeMvpReferenceAction, uploadMvpReferencesAction } from "@/actions/mvp";
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
    <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Referências visuais do MVP</p>
          <p className="text-xs text-muted-foreground">
            Conectadas em todos os nodes de geração — até {MVP_MAX_REFERENCES} imagens
          </p>
        </div>
        <span className="text-xs text-muted-foreground/70">
          {references.length}/{MVP_MAX_REFERENCES}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {references.map((ref) => (
          <div key={ref.url} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ref.url}
              alt={ref.fileName}
              className="size-16 rounded-md border border-white/10 object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(ref.url)}
                disabled={isPending}
                className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex"
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
            className="flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/20 text-[0.625rem] text-muted-foreground transition-premium hover:border-white/40 hover:text-foreground disabled:opacity-50"
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
