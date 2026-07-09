"use client";

import { useActionState, useCallback, useOptimistic, useTransition } from "react";
import Image from "next/image";
import { Upload, X, Info } from "lucide-react";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import {
  uploadDemandReferencesAction,
  deleteDemandReferenceAction,
  updateDemandReferenceRoleAction,
  type DemandReferenceActionState,
} from "@/actions/demand-references";

const ROLE_OPTIONS = [
  { value: "", label: "Papel (opcional)" },
  { value: "siga o estilo visual desta imagem", label: "Estilo" },
  { value: "siga o enquadramento e composição", label: "Composição" },
  { value: "este é o produto que deve aparecer em destaque", label: "Produto" },
  { value: "use como moodboard de atmosfera e cores", label: "Moodboard" },
  { value: "use como referência visual", label: "Outro" },
];

type DemandRef = {
  id: string;
  storage_url: string;
  file_name: string;
  role: string | null;
  position: number;
};

type ClientRef = {
  public_url: string;
  file_name: string;
};

type Props = {
  demandId: string;
  initialRefs: DemandRef[];
  clientRefs: ClientRef[];
};

const initialState: DemandReferenceActionState = {};

export function DemandReferenceManager({ demandId, initialRefs, clientRefs }: Props) {
  const [demandRefs, setOptimisticRefs] = useOptimistic(initialRefs);
  const [isPending, startTransition] = useTransition();

  const [_state, formAction] = useActionState(
    uploadDemandReferencesAction.bind(null, demandId),
    initialState
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      startTransition(async () => {
        const result = await uploadDemandReferencesAction(demandId, {}, formData);
        if (result.error) toast.error(result.error);
        else toast.success(`${result.uploaded} imagem(ns) adicionada(s)`);
      });
    },
    [demandId]
  );

  function handleDelete(ref: DemandRef) {
    startTransition(async () => {
      setOptimisticRefs((prev) => prev.filter((r) => r.id !== ref.id));
      const result = await deleteDemandReferenceAction(demandId, ref.id);
      if (result.error) toast.error(result.error);
    });
  }

  function handleRoleChange(ref: DemandRef, role: string) {
    startTransition(async () => {
      const result = await updateDemandReferenceRoleAction(ref.id, role);
      if (result.error) toast.error(result.error);
    });
  }

  void formAction; // suppress unused warning

  return (
    <div className="space-y-5">
      {/* Referências fixas do cliente (somente leitura) */}
      {clientRefs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Referências do cliente ({clientRefs.length})
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              <Info className="size-2.5" />
              herdadas do perfil — somente leitura
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {clientRefs.map((ref, i) => (
              <div
                key={ref.public_url}
                className="relative size-16 overflow-hidden rounded-lg border border-border/50 opacity-70"
                title={ref.file_name}
              >
                <Image
                  src={ref.public_url}
                  alt={ref.file_name}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="64px"
                />
                <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[9px] text-white">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referências pontuais da demanda */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Referências desta demanda ({demandRefs.length})
        </p>

        {demandRefs.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {demandRefs.map((ref, i) => (
              <div key={ref.id} className="flex flex-col gap-1">
                <div className="relative size-16 overflow-hidden rounded-lg border">
                  <Image
                    src={ref.storage_url}
                    alt={ref.file_name}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="64px"
                  />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[9px] text-white">
                    {(clientRefs.length) + i + 1}
                  </span>
                  <button
                    onClick={() => handleDelete(ref)}
                    disabled={isPending}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-600"
                    title="Remover"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
                <select
                  defaultValue={ref.role ?? ""}
                  onChange={(e) => handleRoleChange(ref, e.target.value)}
                  className="h-6 w-16 rounded border border-border bg-background px-1 text-[9px] text-foreground"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Upload */}
        <ImageDropzone
          disabled={isPending}
          isUploading={isPending}
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onFiles={uploadFiles}
          icon={<Upload className="size-6 text-muted-foreground/60" strokeWidth={1.25} />}
          title="Adicionar referências"
          subtitle="JPEG, PNG, WebP — até 10MB. Envio automático ao soltar."
          minHeight="sm"
        />
      </div>
    </div>
  );
}
