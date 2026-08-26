"use client";

import { useTransition } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadClientPhotoAction, deleteClientPhotoAction } from "@/actions/client-photos";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Photo = { id: string; public_url: string; storage_path: string };

type ClientPhotosFieldProps = {
  clientId: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  compact?: boolean;
};

export function ClientPhotosField({
  clientId,
  photos,
  onChange,
  compact = false,
}: ClientPhotosFieldProps) {
  const [isPending, startTransition] = useTransition();
  const remaining = MAX_PHOTOS - photos.length;

  const handleFiles = (files: File[]) => {
    const toUpload = files.slice(0, remaining);
    for (const file of toUpload) {
      const formData = new FormData();
      formData.append("photo", file);
      startTransition(async () => {
        const result = await uploadClientPhotoAction(clientId, formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.photo) {
          onChange([...photos, result.photo]);
          toast.success("Foto adicionada");
        }
      });
    }
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const result = await deleteClientPhotoAction(clientId, id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onChange(photos.filter((p) => p.id !== id));
      toast.success("Foto removida");
    });
  };

  return (
    <div className={cn("space-y-3", compact && "flex flex-1 flex-col")}>
      {!compact && (
        <div>
          <Label>Fotos do cliente</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Fotos do cliente, produto ou espaço físico — até {MAX_PHOTOS} imagens
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-5")}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.public_url}
                alt="Foto do cliente"
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
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
      )}

      {remaining > 0 && (
        <ImageDropzone
          variant="neon"
          accept={ACCEPT}
          multiple
          disabled={isPending}
          isUploading={isPending}
          onFiles={handleFiles}
          icon={
            <ImageIcon
              className="size-6 text-white/45"
              strokeWidth={1.25}
            />
          }
          title={compact ? `Clique ou arraste (${remaining})` : `Clique ou arraste até ${remaining} foto${remaining > 1 ? "s" : ""}`}
          subtitle="PNG, JPG ou WebP"
          minHeight={compact ? "md" : "sm"}
          className="flex-1"
        />
      )}

      {remaining === 0 && (
        <p className="text-xs text-muted-foreground">
          Limite de {MAX_PHOTOS} fotos atingido.
        </p>
      )}
    </div>
  );
}
