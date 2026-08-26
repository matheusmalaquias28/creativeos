"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClientFromDemandAction } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  demandId: string;
  clientName: string;
  className?: string;
  size?: "sm" | "default";
  onCreated?: (
    clientId: string,
    clientName: string,
    linkedCount?: number
  ) => void;
};

export function CreateClientFromDemandButton({
  demandId,
  clientName,
  className,
  size = "sm",
  onCreated,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createClientFromDemandAction(demandId);
      if (result.error) {
        toast.error("Erro ao criar cliente", { description: result.error });
        return;
      }

      const name = result.clientName ?? clientName;
      const linkedCount = result.linkedCount ?? 1;
      if (onCreated) {
        onCreated(result.clientId!, name, linkedCount);
      } else {
        toast.success(
          linkedCount > 1
            ? `Cliente "${name}" criado · ${linkedCount} demandas vinculadas`
            : `Cliente "${name}" criado e demanda vinculada`
        );
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      size={size}
      disabled={isPending}
      onClick={handleCreate}
      className={cn("gap-1.5", className)}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <UserPlus className="size-3.5" />
      )}
      Cadastrar cliente
    </Button>
  );
}
