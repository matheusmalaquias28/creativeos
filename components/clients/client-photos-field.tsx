"use client";

import { useTransition } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadClientPhotoAction, deleteClientPhotoAction } from "@/actions/client-photos";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_PHOTOS = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Photo = { id: string; public_url: string; storage_path: string };

type ClientPhotosFieldProps = {
  clientId: string;
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
};

export function ClientPhotosField({
  clientId,
  photos,
  onChange,
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
    <div className="space-y-4">
      <div>
        <Label>Fotos do cliente</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Fotos do cliente, produto ou espaço físico — até {MAX_PHOTOS} imagens (PNG, JPG ou WebP, máx. 2MB cada)
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border/50 bg-card/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.public_url}
                alt="Foto do cliente"
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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
          accept={ACCEPT}
          multiple
          disabled={isPending}
          isUploading={isPending}
          onFiles={handleFiles}
          icon={
            <ImageIcon
              className="size-7 text-muted-foreground/60"
              strokeWidth={1.25}
            />
          }
          title={`Arraste até ${remaining} foto${remaining > 1 ? "s" : ""} aqui`}
          subtitle="PNG, JPG ou WebP — máx. 2MB cada"
          minHeight="sm"
        />
      )}

      {remaining === 0 && (
        <p className="text-xs text-muted-foreground">
          Limite de {MAX_PHOTOS} fotos atingido. Remova uma para adicionar outra.
        </p>
      )}
    </div>
  );
}
