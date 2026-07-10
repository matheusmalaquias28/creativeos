"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Loader2, Pause, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelMagnificSpaceGenerationAction,
  generateMagnificSpaceAction,
} from "@/actions/magnific";
import type { MagnificSpaceStatus } from "@/types/database";

type Props = {
  demandId: string;
  status: MagnificSpaceStatus;
  spaceUrl: string | null;
  errorMessage?: string | null;
};

export function MagnificSpaceButton({ demandId, status, spaceUrl, errorMessage }: Props) {
  const [localStatus, setLocalStatus] = useState(status);
  const [isPending, startTransition] = useTransition();

  // O status "de verdade" chega via realtime (router.refresh() em demands-realtime-listener) —
  // sincroniza aqui pra generating → ready/failed aparecer sem depender só do clique local.
  useEffect(() => setLocalStatus(status), [status]);

  function handleGenerate() {
    if (isPending || localStatus === "generating") return;
    setLocalStatus("generating");

    startTransition(async () => {
      const result = await generateMagnificSpaceAction(demandId);
      if (result.error) {
        setLocalStatus(status);
        toast.error("Não foi possível gerar o Space", { description: result.error });
      }
    });
  }

  function handleCancel() {
    if (isPending) return;

    startTransition(async () => {
      const result = await cancelMagnificSpaceGenerationAction(demandId);
      if (result.error) {
        toast.error("Não foi possível pausar", { description: result.error });
        return;
      }
      setLocalStatus("failed");
      toast.info("Geração pausada");
    });
  }

  if (localStatus === "generating") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Gerando Space...
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          title="Cancela a geração em andamento (timeout automático em 2min)"
          className="ml-1 inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300 transition-premium hover:bg-red-500/20 disabled:opacity-60"
        >
          <Pause className="size-3" />
          Pausar
        </button>
      </span>
    );
  }

  if (localStatus === "ready" && spaceUrl) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <a
          href={spaceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-300 transition-premium hover:bg-emerald-500/20"
        >
          <ExternalLink className="size-3.5" />
          Abrir no Spaces
        </a>
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          title="Gera o Space de novo, mesmo já estando pronto"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 text-sm font-medium text-foreground/80 transition-premium hover:bg-black/30 disabled:opacity-60"
        >
          <RefreshCw className="size-3.5" />
          Regenerar
        </button>
      </span>
    );
  }

  if (localStatus === "failed") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={handleGenerate}
        title={errorMessage ?? undefined}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-sm font-medium text-red-300 transition-premium hover:bg-red-500/20 disabled:opacity-60"
      >
        <RefreshCw className="size-3.5" />
        Falha — tentar de novo
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleGenerate}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 text-sm font-medium text-foreground/80 transition-premium hover:bg-black/30 disabled:opacity-60"
    >
      <Wand2 className="size-3.5" />
      Gerar Space
    </button>
  );
}
