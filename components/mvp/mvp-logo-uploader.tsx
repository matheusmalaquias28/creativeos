"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMvpLogoAction } from "@/actions/mvp";
import { Button } from "@/components/ui/button";

type Props = {
  projectId: string;
  logoUrl: string | null;
  disabled?: boolean;
};

export function MvpLogoUploader({ projectId, logoUrl, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("logo", file);
    const result = await uploadMvpLogoAction(projectId, {}, formData);
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (result.error) toast.error("Falha no upload da logo", { description: result.error });
    else toast.success("Logo atualizada");
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--surface-shadow),var(--inner-highlight)]">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo do MVP" className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Logo do MVP</p>
        <p className="truncate text-xs text-muted-foreground">
          {logoUrl ? "Será conectada em todas as páginas" : "Nenhuma logo enviada ainda"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className="shrink-0"
      >
        {isUploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {logoUrl ? "Trocar" : "Enviar logo"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files)}
      />
    </div>
  );
}
