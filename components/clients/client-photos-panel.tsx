"use client";

import { useState, useTransition, useEffect } from "react";
import { Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { deleteClientPhotoAction } from "@/actions/client-photos";
import { Button } from "@/components/ui/button";
import { copyImageToClipboard } from "@/lib/utils/copy-image";

type Photo = { id: string; public_url: string; storage_path: string };

type ClientPhotosPanelProps = {
  clientId: string;
  clientName: string;
  photos: Photo[];
  logoUrl?: string | null;
};

export function ClientPhotosPanel({
  clientId,
  clientName,
  photos: initialPhotos,
  logoUrl,
}: ClientPhotosPanelProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const handleCopyImage = async (id: string, url: string) => {
    try {
      await copyImageToClipboard(url);
      setCopiedId(id);
      toast.success("Imagem copiada — cole no Spaces com Ctrl+V");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar a imagem");
    }
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const result = await deleteClientPhotoAction(clientId, id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      toast.success("Foto removida");
    });
  };

  if (!logoUrl && photos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border-strong bg-surface/50 px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhuma foto do cliente adicionada ainda. Acesse o{" "}
        <strong className="font-semibold text-foreground">Onboarding</strong> para enviar.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {logoUrl && (
        <div className="space-y-2">
          <p className="text-[0.8125rem] font-semibold text-muted-foreground">Logo</p>
          <div className="group relative inline-flex overflow-hidden rounded-xl border border-border bg-surface p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Logo do cliente"
              className="h-20 w-auto object-contain"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-end justify-start gap-1 bg-gradient-to-t from-background/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => handleCopyImage("logo", logoUrl)}
                className="flex size-7 items-center justify-center rounded-lg border border-border bg-popover/95 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent"
                aria-label="Copiar logo"
              >
                {copiedId === "logo" ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
              <a
                href={logoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-7 items-center justify-center rounded-lg border border-border bg-popover/95 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent"
                aria-label="Abrir em nova aba"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[0.8125rem] font-semibold text-muted-foreground">
            Fotos — clique em <Copy className="inline size-3" /> para copiar e colar no Spaces
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.public_url}
              alt="Foto do cliente"
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-background/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleCopyImage(photo.id, photo.public_url)}
                  className="flex size-7 items-center justify-center rounded-lg border border-border bg-popover/95 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent"
                  aria-label="Copiar imagem"
                >
                  {copiedId === photo.id ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
                <a
                  href={photo.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-7 items-center justify-center rounded-lg border border-border bg-popover/95 text-foreground shadow-[var(--surface-shadow)] transition-colors hover:bg-accent"
                  aria-label="Abrir em nova aba"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <Button
                type="button"
                size="icon-xs"
                variant="destructive"
                disabled={isPending}
                onClick={() => handleRemove(photo.id)}
                aria-label="Remover foto"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
          </div>
        </div>
      )}
    </div>
  );
}
