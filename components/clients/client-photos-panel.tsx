"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { removeClientPhotoAction } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

type Photo = { url: string; storagePath: string };

type ClientPhotosPanelProps = {
  clientId: string;
  photos: Photo[];
};

export function ClientPhotosPanel({ clientId, photos: initialPhotos }: ClientPhotosPanelProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopyAll = async () => {
    const urls = photos.map((p) => p.url).join("\n");
    await navigator.clipboard.writeText(urls);
    setCopied(true);
    toast.success(`${photos.length} URL${photos.length > 1 ? "s" : ""} copiada${photos.length > 1 ? "s" : ""}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemove = (storagePath: string) => {
    startTransition(async () => {
      const result = await removeClientPhotoAction(clientId, storagePath);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.storagePath !== storagePath));
      toast.success("Foto removida");
    });
  };

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma foto do cliente adicionada ainda. Acesse o{" "}
        <strong className="font-medium">Onboarding</strong> para enviar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {photos.length} foto{photos.length > 1 ? "s" : ""} — copie as URLs para usar no Spaces
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyAll}
          className="gap-2"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copiado" : "Copiar todas"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((photo) => (
          <div
            key={photo.storagePath}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border/50 bg-card/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Foto do cliente"
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <a
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-7 items-center justify-center rounded-md bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                aria-label="Abrir em nova aba"
              >
                <ExternalLink className="size-3.5" />
              </a>
              <Button
                type="button"
                size="icon-xs"
                variant="destructive"
                disabled={isPending}
                onClick={() => handleRemove(photo.storagePath)}
                aria-label="Remover foto"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
