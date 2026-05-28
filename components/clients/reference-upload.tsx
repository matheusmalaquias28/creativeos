"use client";

import { useActionState, useCallback, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  uploadReferencesAction,
  type ReferenceActionState,
} from "@/actions/references";
import { ImageDropzone } from "@/components/ui/image-dropzone";

const initialState: ReferenceActionState = {};

type ReferenceUploadProps = {
  clientId: string;
};

export function ReferenceUpload({ clientId }: ReferenceUploadProps) {
  const [state, formAction] = useActionState(
    uploadReferencesAction.bind(null, clientId),
    initialState
  );
  const [isPending, startTransition] = useTransition();

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      startTransition(() => {
        formAction(formData);
      });
    },
    [formAction]
  );

  useEffect(() => {
    if (state.success && state.uploaded) {
      toast.success(
        `${state.uploaded} imagem(ns) enviada(s) com sucesso`
      );
    }
    if (state.error) toast.error(state.error);
  }, [state]);

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
