"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  removeClientLogoAction,
  uploadClientLogoAction,
} from "@/actions/onboarding";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isAllowedLogoFile, isSvgLogoFile, LOGO_ACCEPT } from "@/lib/utils/logo-file";

type LogoUploadFieldProps = {
  clientId: string;
  logoUrl?: string;
  onLogoChange: (data: { logoUrl?: string; logoStoragePath?: string }) => void;
};

export function LogoUploadField({
  clientId,
  logoUrl,
  onLogoChange,
}: LogoUploadFieldProps) {
  const [preview, setPreview] = useState(logoUrl ?? "");
  const [isPending, startTransition] = useTransition();

  const handleUpload = (file: File) => {
    if (isSvgLogoFile(file)) {
      toast.error(
        "SVG não é suportado. Exporte a logo como PNG, JPG ou WebP."
      );
      return;
    }
    if (!isAllowedLogoFile(file)) {
      toast.error("Use PNG, JPG ou WebP (máx. 5MB).");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);

    startTransition(async () => {
      const result = await uploadClientLogoAction(clientId, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.logoUrl) {
        setPreview(result.logoUrl);
        onLogoChange({
          logoUrl: result.logoUrl,
          logoStoragePath: result.logoStoragePath,
        });
        toast.success("Logo enviada");
      }
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeClientLogoAction(clientId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPreview("");
      onLogoChange({ logoUrl: undefined, logoStoragePath: undefined });
      toast.success("Logo removida");
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Logo do cliente</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Arraste a imagem para a área abaixo — PNG, JPG ou WebP (máx. 5MB)
        </p>
      </div>

      {preview ? (
        <div className="space-y-3">
          <ImageDropzone
            disabled={isPending}
            isUploading={isPending}
            accept={LOGO_ACCEPT}
            multiple={false}
            onFiles={(files) => handleUpload(files[0])}
            title=""
            minHeight="sm"
            className={cn(isPending && "opacity-60")}
          >
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
              <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Logo do cliente"
                  className="max-h-full max-w-full object-contain p-2"
                />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-foreground/90">
                  Arraste uma nova logo aqui para substituir
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solte o arquivo sobre esta área
                </p>
              </div>
            </div>
          </ImageDropzone>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleRemove}
            className="text-muted-foreground"
          >
            <Trash2 className="size-4" />
            Remover logo
          </Button>
        </div>
      ) : (
        <ImageDropzone
          disabled={isPending}
          isUploading={isPending}
          accept={LOGO_ACCEPT}
          multiple={false}
          onFiles={(files) => handleUpload(files[0])}
          icon={
            <ImageIcon
              className="size-8 text-muted-foreground/60"
              strokeWidth={1.25}
            />
          }
          title="Arraste a logo para esta área"
          subtitle="PNG, JPG ou WebP — máx. 5MB"
        />
      )}
    </div>
  );
}
