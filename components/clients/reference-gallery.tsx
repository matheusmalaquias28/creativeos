"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteReferenceAction } from "@/actions/references";
import { Button } from "@/components/ui/button";
import type { ClientReference } from "@/types";

type ReferenceGalleryProps = {
  clientId: string;
  references: ClientReference[];
};

export function ReferenceGallery({ clientId, references }: ReferenceGalleryProps) {
  const [isPending, startTransition] = useTransition();

  if (references.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma referência enviada ainda.
      </p>
    );
  }

  const handleDelete = (referenceId: string) => {
    startTransition(async () => {
      const result = await deleteReferenceAction(clientId, referenceId);
      if (result.error) toast.error(result.error);
      else toast.success("Referência removida");
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {references.map((ref) => (
        <div
          key={ref.id}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border/50 bg-card/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ref.public_url}
            alt={ref.file_name}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-premium group-hover:opacity-100">
            <Button
              type="button"
              size="icon-xs"
              variant="destructive"
              disabled={isPending}
              onClick={() => handleDelete(ref.id)}
              aria-label="Remover referência"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
