"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pause, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelMagnificSpaceGenerationAction,
  generateMagnificSpaceAction,
  getMagnificSpaceStatusAction,
} from "@/actions/magnific";
import { createClient } from "@/lib/supabase/client";
import type { MagnificSpaceStatus } from "@/types/database";
import { buttonVariants } from "@/components/ui/button";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 5000;

type Props = {
  demandId: string;
  status: MagnificSpaceStatus;
  spaceUrl: string | null;
  errorMessage?: string | null;
};

export function MagnificSpaceButton({ demandId, status, spaceUrl, errorMessage }: Props) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState(status);
  const [localSpaceUrl, setLocalSpaceUrl] = useState(spaceUrl);
  const [localError, setLocalError] = useState(errorMessage ?? null);
  const [isPending, startTransition] = useTransition();

  // Props novas (ex: router.refresh() de outro lugar) continuam mandando.
  useEffect(() => setLocalStatus(status), [status]);
  useEffect(() => setLocalSpaceUrl(spaceUrl), [spaceUrl]);
  useEffect(() => setLocalError(errorMessage ?? null), [errorMessage]);

  // Enquanto está gerando, o botão acompanha o desfecho por conta própria:
  // realtime filtrado nesta demanda + polling de fallback (o listener global de
  // router.refresh() pode não entregar — ex: evento descartado por payload
  // grande da linha). O estado local atualiza na hora; o refresh sincroniza o
  // resto da página depois.
  useEffect(() => {
    if (localStatus !== "generating") return;

    let finished = false;

    const applySnapshot = (next: {
      status: string;
      spaceUrl: string | null;
      errorMessage: string | null;
    }) => {
      if (finished || next.status === "generating" || next.status === "not_generated") return;
      finished = true;
      setLocalStatus(next.status as MagnificSpaceStatus);
      setLocalSpaceUrl(next.spaceUrl);
      setLocalError(next.errorMessage);
      if (next.status === "ready") {
        toast.success("Magnific Space pronto");
      } else if (next.errorMessage && next.errorMessage !== "Cancelado pelo operador") {
        toast.error("Falha ao gerar o Space", { description: next.errorMessage });
      }
      router.refresh();
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`magnific-space-${demandId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creative_demands",
          filter: `id=eq.${demandId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (typeof row.magnific_space_status !== "string") return;
          applySnapshot({
            status: row.magnific_space_status,
            spaceUrl: typeof row.magnific_space_url === "string" ? row.magnific_space_url : null,
            errorMessage:
              typeof row.magnific_space_error === "string" ? row.magnific_space_error : null,
          });
        }
      )
      .subscribe();

    const poller = setInterval(() => {
      void getMagnificSpaceStatusAction(demandId).then((snapshot) => {
        if (snapshot) applySnapshot(snapshot);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(poller);
      void supabase.removeChannel(channel);
    };
  }, [localStatus, demandId, router]);

  function handleGenerate() {
    if (isPending || localStatus === "generating") return;
    setLocalStatus("generating");
    setLocalError(null);

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
      <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[0.8125rem] font-medium", tones.blue.badge)}>
        <Loader2 className="size-3.5 animate-spin" />
        Gerando Space...
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          title="Cancela a geração em andamento (timeout automático em 2min)"
          className="ml-1 inline-flex items-center gap-1 rounded-md border border-tone-red/25 bg-tone-red/12 px-2 py-0.5 text-xs font-semibold text-tone-red transition-premium hover:bg-tone-red/18 disabled:opacity-60"
        >
          <Pause className="size-3" />
          Pausar
        </button>
      </span>
    );
  }

  if (localStatus === "ready" && localSpaceUrl) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <a
          href={localSpaceUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "positive", size: "sm" }))}
        >
          <ExternalLink className="size-3.5" />
          Abrir no Spaces
        </a>
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          title="Gera o Space de novo, mesmo já estando pronto"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
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
        title={localError ?? undefined}
        className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
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
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      <Wand2 className="size-3.5 text-tone-pink" />
      Gerar Space
    </button>
  );
}
