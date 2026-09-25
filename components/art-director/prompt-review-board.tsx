"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";
import { PromptCard } from "./prompt-card";
import { GenerationProgress } from "./generation-progress";
import type { PromptJob, JobReference } from "@/services/art-director";

type Props = {
  demandId: string;
  initialJobs: PromptJob[];
  initialArts: Record<string, string>;
  ready: boolean;
  missing: string[];
  hasClientPhotos: boolean;
};

/**
 * Coluna única, não grid: prompt é texto e grid de duas colunas obriga a ler em
 * zigue-zague. O caminho feliz — prompts bons, aprovar tudo — é um clique só,
 * porque 400 artes/mês passam por aqui.
 */
export function PromptReviewBoard({
  demandId,
  initialJobs,
  initialArts,
  ready,
  missing,
  hasClientPhotos,
}: Props) {
  const [jobs, setJobs] = useState<PromptJob[]>(initialJobs);
  const [arts, setArts] = useState<Record<string, string>>(initialArts);
  const [preparing, setPreparing] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const refreshReferences = useCallback(async (jobId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("art_job_reference")
      .select("id, asset_id, storage_url, role, intent, position, source")
      .eq("job_id", jobId)
      .order("position", { ascending: true });

    if (!data) return;
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, references: data as JobReference[] } : j))
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`art-prompts-${demandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "art_generation_job",
          filter: `demand_id=eq.${demandId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removed = payload.old as { id: string };
            setJobs((prev) => prev.filter((j) => j.id !== removed.id));
            return;
          }

          const incoming = payload.new as Omit<PromptJob, "references">;
          setJobs((prev) => {
            const existing = prev.find((j) => j.id === incoming.id);
            // Realtime não traz as referências (tabela separada) — preserva as
            // que já temos em vez de piscar a faixa vazia.
            const merged: PromptJob = {
              ...incoming,
              references: existing?.references ?? [],
            };
            const next = existing
              ? prev.map((j) => (j.id === incoming.id ? { ...j, ...merged } : j))
              : [...prev, merged];
            return next.sort((a, b) => a.art_index - b.art_index);
          });

          // As referências chegam numa tabela sem Realtime; quando um job entra
          // em awaiting_approval elas já foram gravadas, então busca uma vez.
          if (incoming.status === "awaiting_approval") {
            void refreshReferences(incoming.id);
          }
        }
      )
      // A arte pronta aparece sem recarregar: art_version está publicada em
      // supabase_realtime desde a migration original do pipeline.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "art_version" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const version = payload.new as {
            job_id: string;
            result_url: string;
            is_current: boolean;
          };
          if (!version.is_current) return;
          setArts((prev) => ({ ...prev, [version.job_id]: version.result_url }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demandId, refreshReferences]);

  function patchJob(jobId: string, patch: Partial<PromptJob>) {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j)));
  }

  async function handlePrepare() {
    setPreparing(true);
    try {
      const res = await fetch("/api/art-gen/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao gerar prompts");
        return;
      }
      setArts({});
      toast.success("Dirigindo as artes — os prompts aparecem conforme ficam prontos");
    } catch {
      toast.error("Erro ao gerar prompts");
    } finally {
      setPreparing(false);
    }
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      const res = await fetch("/api/art-gen/approve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId }),
      });
      const data = (await res.json()) as { approved?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao aprovar");
        return;
      }
      toast.success(`${data.approved ?? 0} arte(s) na fila de geração`);
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setApprovingAll(false);
    }
  }

  const awaiting = jobs.filter((j) => j.status === "awaiting_approval").length;

  const writingCounts = useMemo(() => {
    const working = jobs.filter(
      (j) => j.status === "draft" || j.status === "writing_prompt"
    ).length;
    const done = jobs.filter(
      (j) => j.status !== "draft" && j.status !== "writing_prompt"
    ).length;
    return { total: jobs.length, done, working, failed: 0 };
  }, [jobs]);

  const renderCounts = useMemo(() => {
    const relevant = jobs.filter((j) =>
      ["queued", "processing", "succeeded", "failed"].includes(j.status)
    );
    const working = relevant.filter(
      (j) => j.status === "queued" || j.status === "processing"
    ).length;
    return {
      total: relevant.length,
      done: relevant.filter((j) => j.status === "succeeded").length,
      working,
      failed: relevant.filter((j) => j.status === "failed").length,
    };
  }, [jobs]);

  // Só as artes já prontas entram no navegador de tela cheia.
  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      jobs
        .filter((j) => arts[j.id])
        .map((j) => ({
          url: arts[j.id],
          label: `Arte ${j.art_index + 1}`,
          downloadName: `arte-${j.art_index + 1}.png`,
        })),
    [jobs, arts]
  );

  const openFullscreen = useCallback(
    (jobId: string) => {
      const url = arts[jobId];
      const idx = lightboxItems.findIndex((item) => item.url === url);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [arts, lightboxItems]
  );

  const busy = writingCounts.working > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void handlePrepare()}
            disabled={!ready || preparing || busy}
            className="gap-2"
          >
            {preparing || busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {jobs.length > 0 ? "Gerar prompts de novo" : "Gerar prompts"}
          </Button>

          {awaiting > 0 && (
            <Button
              variant="secondary"
              onClick={() => void handleApproveAll()}
              disabled={approvingAll}
              className="gap-2"
            >
              {approvingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              Aprovar todas ({awaiting})
            </Button>
          )}
        </div>

        <Link
          href={`/demands/${demandId}/curation`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
        >
          Ir para a curadoria
        </Link>
      </div>

      <GenerationProgress counts={writingCounts} label="Dirigindo as artes" />
      <GenerationProgress counts={renderCounts} label="Gerando as imagens" />

      {!ready && (
        <p className="text-sm text-warning">
          Cliente sem kit completo — falta: {missing.join(", ")}.
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum prompt ainda. Gere os prompts para revisar antes de queimar crédito de imagem.
        </p>
      ) : (
        <div className="space-y-5">
          {jobs.map((job) => (
            <PromptCard
              key={job.id}
              job={job}
              artUrl={arts[job.id] ?? null}
              hasClientPhotos={hasClientPhotos}
              onLocalChange={patchJob}
              onOpenFullscreen={openFullscreen}
            />
          ))}
        </div>
      )}

      <ImageLightbox
        items={lightboxItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
