"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { uploadReferencesAction } from "@/actions/references";
import { ImageDropzone } from "@/components/ui/image-dropzone";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ReferenceUploadProps = {
  clientId: string;
};

export function ReferenceUpload({ clientId }: ReferenceUploadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`Arquivo muito grande: ${file.name} (máx. 10MB)`);
          return;
        }
      }

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      startTransition(async () => {
        const result = await uploadReferencesAction(clientId, {}, formData);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.success) {
          toast.success(
            `${result.uploaded} imagem(ns) enviada(s) com sucesso`
          );
          router.refresh();
        }
      });
    },
    [clientId, router]
  );

  return (
    <ImageDropzone
      disabled={isPending}
      isUploading={isPending}
      multiple
      accept="image/jpeg,image/png,image/webp,image/gif"
      onFiles={uploadFiles}
      icon={
        <Upload className="size-8 text-muted-foreground/60" strokeWidth={1.25} />
      }
      title="Arraste imagens para esta área"
      subtitle="JPEG, PNG, WebP ou GIF — até 10MB cada. Envio automático ao soltar."
      minHeight="lg"
    />
  );
}
