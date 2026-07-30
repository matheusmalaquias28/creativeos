"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pause, Play, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelMvpGenerationAction,
  generateMvpAction,
  getMvpStatusAction,
} from "@/actions/mvp";
import { createClient } from "@/lib/supabase/client";
import { mvpTotalBatches, type MvpStatus } from "@/types/mvp";

const POLL_INTERVAL_MS = 5000;

type Props = {
  projectId: string;
  status: MvpStatus;
  spaceUrl: string | null;
  errorMessage?: string | null;
  /** libera o GERAR MVP só quando as páginas já foram organizadas */
  canGenerate: boolean;
  pageCount: number;
  generatedBatches: number;
};

/**
 * Botão dinâmico da geração: o MVP é gerado de 10 em 10 páginas e o rótulo
 * acompanha o progresso em tempo real ("lote N de X"). Falha/pausa no meio
 * mantém os lotes prontos — o botão vira "Continuar" do lote seguinte.
 */
export function MvpGenerateButton({
  projectId,
  status,
  spaceUrl,
  errorMessage,
  canGenerate,
  pageCount,
  generatedBatches,
}: Props) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState(status);
  const [localSpaceUrl, setLocalSpaceUrl] = useState(spaceUrl);
  const [localError, setLocalError] = useState(errorMessage ?? null);
  const [localBatches, setLocalBatches] = useState(generatedBatches);
  const [isPending, startTransition] = useTransition();

  const totalBatches = mvpTotalBatches(pageCount);

  useEffect(() => setLocalStatus(status), [status]);
  useEffect(() => setLocalSpaceUrl(spaceUrl), [spaceUrl]);
  useEffect(() => setLocalError(errorMessage ?? null), [errorMessage]);
  useEffect(() => setLocalBatches(generatedBatches), [generatedBatches]);

  // Enquanto gera, acompanha progresso e desfecho por realtime + polling —
  // mesmo padrão do MagnificSpaceButton das demandas, com o extra do contador
  // de lotes atualizando o rótulo em tempo real.
  useEffect(() => {
    if (localStatus !== "generating") return;

    let finished = false;

    const applySnapshot = (next: {
      status: string;
      spaceUrl: string | null;
      errorMessage: string | null;
      generatedBatches: number;
    }) => {
      if (finished) return;
      setLocalBatches(next.generatedBatches);
      if (next.status === "generating") return;
      finished = true;
      setLocalStatus(next.status as MvpStatus);
      setLocalSpaceUrl(next.spaceUrl);
      setLocalError(next.errorMessage);
      if (next.status === "ready") {
        toast.success("MVP pronto no Magnific Spaces");
      } else if (next.errorMessage && !next.errorMessage.includes("Cancelado pelo operador")) {
        toast.error("Falha ao gerar o MVP", { description: next.errorMessage });
      }
      router.refresh();
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`mvp-project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mvp_projects", filter: `id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (typeof row.status !== "string") return;
          applySnapshot({
            status: row.status,
            spaceUrl: typeof row.space_url === "string" ? row.space_url : null,
            errorMessage: typeof row.error === "string" ? row.error : null,
            generatedBatches:
              typeof row.generated_batches === "number" ? row.generated_batches : 0,
          });
        }
      )
      .subscribe();

    const poller = setInterval(() => {
      void getMvpStatusAction(projectId).then((snapshot) => {
        if (snapshot) applySnapshot(snapshot);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(poller);
      void supabase.removeChannel(channel);
    };
  }, [localStatus, projectId, router]);

  function handleGenerate() {
    if (isPending || localStatus === "generating") return;
    if (localStatus === "ready") setLocalBatches(0);
    setLocalStatus("generating");
    setLocalError(null);

    startTransition(async () => {
      const result = await generateMvpAction(projectId);
      if (result.error) {
        setLocalStatus(status);
        toast.error("Não foi possível gerar o MVP", { description: result.error });
      }
    });
  }

  function handleCancel() {
    if (isPending) return;
    startTransition(async () => {
      const result = await cancelMvpGenerationAction(projectId);
      if (result.error) {
        toast.error("Não foi possível pausar", { description: result.error });
        return;
      }
      setLocalStatus("failed");
      toast.info("Geração pausada");
    });
  }

  if (localStatus === "generating") {
    const currentBatch = Math.min(localBatches + 1, totalBatches);
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Gerando MVP — lote {currentBatch} de {totalBatches}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          title="Pausa a geração — os lotes já prontos ficam salvos e você continua depois"
          className="ml-1 inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300 transition-premium hover:bg-red-500/20 disabled:opacity-60"
        >
          <Pause className="size-3" />
          Pausar
        </button>
      </span>
    );
  }

  if (localStatus === "ready" && localSpaceUrl) {
    return (
      <span className="inline-flex items-center gap-2">
        <a
          href={localSpaceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-300 transition-premium hover:bg-emerald-500/20"
        >
          <ExternalLink className="size-4" />
          Abrir MVP no Spaces
        </a>
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          title="Gera o MVP do zero em um Space novo"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 text-sm font-medium text-foreground/80 transition-premium hover:bg-black/30 disabled:opacity-60"
        >
          <RefreshCw className="size-4" />
          Regenerar
        </button>
      </span>
    );
  }

  // Falha/pausa com lotes já prontos: retoma do próximo lote.
  if (localStatus === "failed" && localBatches > 0 && localBatches < totalBatches) {
    return (
      <span className="inline-flex items-center gap-2">
        {localSpaceUrl && (
          <a
            href={localSpaceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-foreground/80 transition-premium hover:bg-black/30"
            title="Abre o Space com os lotes já gerados"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          title={localError ?? undefined}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 text-sm font-medium text-amber-300 transition-premium hover:bg-amber-500/20 disabled:opacity-60"
        >
          <Play className="size-4" />
          Continuar — lote {localBatches + 1} de {totalBatches}
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
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition-premium hover:bg-red-500/20 disabled:opacity-60"
      >
        <RefreshCw className="size-4" />
        Falha — tentar de novo
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending || !canGenerate}
      onClick={handleGenerate}
      title={canGenerate ? undefined : "Aguarde a organização das páginas terminar"}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-5 text-sm font-semibold text-emerald-200 transition-premium hover:bg-emerald-500/25 disabled:opacity-50"
    >
      <Wand2 className="size-4" />
      GERAR MVP{totalBatches > 1 ? ` (${totalBatches} lotes de 10 págs)` : ""}
    </button>
  );
}
