"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  archiveClientAction,
  unarchiveClientAction,
} from "@/actions/clients";
import { Button } from "@/components/ui/button";

type ArchiveClientButtonProps = {
  clientId: string;
  isArchived: boolean;
};

export function ArchiveClientButton({
  clientId,
  isArchived,
}: ArchiveClientButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (
      !isArchived &&
      !window.confirm(
        "Arquivar este cliente? Ele ficará marcado como desativado, mas poderá ser reativado depois."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = isArchived
        ? await unarchiveClientAction(clientId)
        : await archiveClientAction(clientId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        isArchived ? "Cliente reativado" : "Cliente arquivado com sucesso"
      );
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="gap-2"
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {isArchived ? "Reativando..." : "Arquivando..."}
        </>
      ) : isArchived ? (
        <>
          <ArchiveRestore className="size-4" strokeWidth={1.75} />
          Reativar cliente
        </>
      ) : (
        <>
          <Archive className="size-4" strokeWidth={1.75} />
          Arquivar cliente
        </>
      )}
    </Button>
  );
}
