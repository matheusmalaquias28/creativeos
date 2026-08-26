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
  compact?: boolean;
};

export function LogoUploadField({
  clientId,
  logoUrl,
  onLogoChange,
  compact = false,
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
    <div className={cn("space-y-3", compact && "flex flex-1 flex-col")}>
      {!compact && (
        <div>
          <Label>Logo do cliente</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Arraste a imagem para a área abaixo — PNG, JPG ou WebP (máx. 5MB)
          </p>
        </div>
      )}

      {preview ? (
        <div className="space-y-2">
          <ImageDropzone
            variant="neon"
            disabled={isPending}
            isUploading={isPending}
            accept={LOGO_ACCEPT}
            multiple={false}
            onFiles={(files) => handleUpload(files[0])}
            title=""
            minHeight="sm"
            className={cn("flex-1", isPending && "opacity-60")}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Logo do cliente"
                  className="max-h-full max-w-full object-contain p-2"
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Clique ou solte para substituir
              </p>
            </div>
          </ImageDropzone>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleRemove}
            className="h-7 text-xs text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
            Remover
          </Button>
        </div>
      ) : (
        <ImageDropzone
          variant="neon"
          disabled={isPending}
          isUploading={isPending}
          accept={LOGO_ACCEPT}
          multiple={false}
          onFiles={(files) => handleUpload(files[0])}
          icon={
            <ImageIcon
              className="size-6 text-white/45"
              strokeWidth={1.25}
            />
          }
          title="Clique ou arraste a logo"
          subtitle="PNG, JPG ou WebP"
          minHeight={compact ? "md" : "sm"}
          className="flex-1"
        />
      )}
    </div>
  );
}
