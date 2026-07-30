"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getMvpOrganizeSnapshotAction, retryMvpOrganizationAction } from "@/actions/mvp";
import { createClient } from "@/lib/supabase/client";

const POLL_INTERVAL_MS = 3000;

/**
 * Loader em tempo real da organização: acompanha via realtime + polling e mostra
 * uma miniatura A4 por página já criada (as páginas vão "brotando" conforme cada
 * trecho do docx é concluído). Quando o count muda, um router.refresh() renderiza
 * as páginas reais no quadro abaixo. Em falha, oferece o retry (que retoma do
 * checkpoint, sem re-pagar o que já foi organizado).
 */
export function MvpOrganizingWatcher({
  projectId,
  status,
  initialPageCount,
  errorMessage,
}: {
  projectId: string;
  status: "organizing" | "organize_failed";
  initialPageCount: number;
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "organizing") return;

    let lastCount = initialPageCount;
    let finished = false;

    const applySnapshot = (next: { status: string; pageCount: number }) => {
      if (finished) return;
      if (next.pageCount !== lastCount) {
        lastCount = next.pageCount;
        setPageCount(next.pageCount);
        router.refresh();
      }
      if (next.status !== "organizing") {
        finished = true;
        if (next.status === "organized") {
          toast.success(`Conteúdo organizado — ${next.pageCount} página(s) criadas`);
        }
        router.refresh();
      }
    };

    // Realtime: o UPDATE pode vir sem o jsonb de pages (payload grande é
    // descartado), então o evento serve de gatilho para buscar o snapshot leve.
    const supabase = createClient();
    const channel = supabase
      .channel(`mvp-organize-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "mvp_projects", filter: `id=eq.${projectId}` },
        () => {
          void getMvpOrganizeSnapshotAction(projectId).then((snapshot) => {
            if (snapshot) applySnapshot(snapshot);
          });
        }
      )
      .subscribe();

    const poller = setInterval(() => {
      void getMvpOrganizeSnapshotAction(projectId).then((snapshot) => {
        if (snapshot) applySnapshot(snapshot);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(poller);
      void supabase.removeChannel(channel);
    };
  }, [status, projectId, initialPageCount, router]);

  if (status === "organizing") {
    return (
      <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-sm text-sky-200">
            <Loader2 className="size-4 animate-spin" />
            Organizando o conteúdo em páginas A4...
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-100">
            <FileText className="size-3" />
            {pageCount} página{pageCount === 1 ? "" : "s"} criada{pageCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-1.5">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div
              key={i}
              className="flex h-11 w-8 items-end justify-center rounded-[3px] border border-sky-400/40 bg-white/90 pb-0.5 text-[0.5rem] font-semibold text-sky-900 shadow-sm"
              title={`Página ${i + 1}`}
            >
              {i + 1}
            </div>
          ))}
          {/* próxima página "chegando" */}
          <div className="h-11 w-8 animate-pulse rounded-[3px] border border-dashed border-sky-400/50 bg-sky-400/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      <span>
        Falha ao organizar o conteúdo{errorMessage ? `: ${errorMessage}` : ""}
        {pageCount > 0 && ` — ${pageCount} página(s) já salvas serão aproveitadas no retry`}
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await retryMvpOrganizationAction(projectId);
            if (result.error) toast.error(result.error);
            else router.refresh();
          })
        }
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium transition-premium hover:bg-red-500/20 disabled:opacity-60"
      >
        <RefreshCw className="size-3" />
        Tentar de novo
      </button>
    </div>
  );
}
