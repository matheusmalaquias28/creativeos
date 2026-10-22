"use client";

import { useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { archiveVideoDemandAction } from "@/actions/video-demands";
import { cn } from "@/lib/utils";

export function ArchiveVideoButton({ demandId }: { demandId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await archiveVideoDemandAction(demandId);
      if (result.error) {
        toast.error("Erro ao arquivar", { description: result.error });
        return;
      }
      toast.success("Demanda de vídeo arquivada");
      router.push("/videos");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition-premium hover:border-border-strong hover:bg-accent disabled:opacity-60"
      )}
    >
      <Archive className="size-3.5" />
      Arquivar
    </button>
  );
}
