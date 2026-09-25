"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { JobReference } from "@/services/art-director";

type Props = {
  jobId: string;
  references: JobReference[];
  editable: boolean;
  onRemoved: (referenceId: string) => void;
};

/**
 * A ordem mostrada aqui é a ordem em que as imagens chegam ao modelo. O `intent`
 * escrito pela IA aparece no hover — é o que explica por que cada referência
 * está ali.
 */
export function ReferenceStrip({ jobId, references, editable, onRemoved }: Props) {
  const [removing, setRemoving] = useState<string | null>(null);

  if (references.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma referência anexada a esta arte.
      </p>
    );
  }

  async function handleRemove(referenceId: string) {
    setRemoving(referenceId);
    try {
      const res = await fetch(
        `/api/art-gen/${jobId}/references?referenceId=${encodeURIComponent(referenceId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Erro ao remover referência");
        return;
      }
      onRemoved(referenceId);
    } catch {
      toast.error("Erro ao remover referência");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {references.map((ref, i) => (
        <figure key={ref.id} className="group/ref relative w-28">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border dark:border-white/8">
            <Image
              src={ref.storage_url}
              alt={ref.intent ?? ref.role}
              fill
              sizes="112px"
              className="object-cover"
              unoptimized
            />
            <span className="absolute left-1 top-1 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground backdrop-blur">
              {i + 1}
            </span>
            {editable && (
              <button
                type="button"
                onClick={() => void handleRemove(ref.id)}
                disabled={removing === ref.id}
                aria-label="Remover referência"
                className="transition-premium absolute right-1 top-1 rounded-md bg-background/80 p-1 opacity-0 backdrop-blur group-hover/ref:opacity-100 disabled:opacity-40"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <figcaption className="mt-1.5 space-y-1">
            <Badge variant="ghost" className="px-0">
              {ref.role}
            </Badge>
            {ref.intent && (
              <p className="line-clamp-2 text-[0.6875rem] leading-snug text-muted-foreground">
                {ref.intent}
              </p>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
