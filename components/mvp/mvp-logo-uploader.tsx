"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMvpLogoAction } from "@/actions/mvp";

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
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo do MVP" className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Logo do MVP</p>
        <p className="truncate text-xs text-muted-foreground">
          {logoUrl ? "Será conectada em todas as páginas" : "Nenhuma logo enviada ainda"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 text-xs font-medium text-foreground/80 transition-premium hover:bg-black/30 disabled:opacity-50"
      >
        {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
        {logoUrl ? "Trocar" : "Enviar logo"}
      </button>
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
