"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { Download, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArtCard } from "./art-card";
import type { ArtJobWithVersions } from "@/services/art-gen";

type Props = {
  demandId: string;
  initialJobs: ArtJobWithVersions[];
};

// ---------------------------------------------------------------------------
// ArtCurationGrid
// ---------------------------------------------------------------------------

export function ArtCurationGrid({ demandId, initialJobs }: Props) {
  const [jobs, setJobs] = useState<ArtJobWithVersions[]>(initialJobs);
  const initialized = useRef(false);

  // ------------------------------------------------------------------
  // Supabase Realtime — atualiza jobs e versões em tempo real
  // ------------------------------------------------------------------
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    const channel = supabase
      .channel(`art-curation-${demandId}`)
      // Mudanças nos jobs da demanda
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "art_generation_job",
          filter: `demand_id=eq.${demandId}`,
        },
        (payload) => {
          const updated = payload.new as ArtJobWithVersions;
          setJobs((prev) => {
            const exists = prev.some((j) => j.id === updated.id);
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== (payload.old as { id: string }).id);
            }
            if (!exists) {
              return [...prev, { ...updated, versions: [], currentVersion: null }].sort(
                (a, b) => a.art_index - b.art_index
              );
            }
            return prev.map((j) =>
              j.id === updated.id ? { ...j, ...updated } : j
            );
          });
        }
      )
      // Novas versões de arte (INSERT e UPDATE de is_current)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "art_version",
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;

          const changedVersion = payload.new as {
            id: string;
            job_id: string;
            version_number: number;
            result_url: string;
            storage_path: string;
            instruction: string | null;
            is_current: boolean;
            created_at: string;
          };

          setJobs((prev) =>
            prev.map((j) => {
              if (j.id !== changedVersion.job_id) return j;

              // Substitui ou adiciona a versão na lista
              const existsInList = j.versions.some((v) => v.id === changedVersion.id);
              const updatedVersions = existsInList
                ? j.versions.map((v) => (v.id === changedVersion.id ? changedVersion : v))
                : [changedVersion, ...j.versions];

              // Se is_current, desmarca as outras
              const versions = changedVersion.is_current
                ? updatedVersions.map((v) => ({ ...v, is_current: v.id === changedVersion.id }))
                : updatedVersions;

              const currentVersion = versions.find((v) => v.is_current) ?? j.currentVersion;

              return { ...j, versions, currentVersion };
            })
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demandId]);

  // ------------------------------------------------------------------
  // Handlers chamados pelos cards
  // ------------------------------------------------------------------

  const handleApprove = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/art-gen/${jobId}/approve`, { method: "POST" });
    if (!res.ok) throw new Error("Falha ao aprovar");
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, approved: true } : j))
    );
  }, []);

  const handleRegenerate = useCallback(
    async (jobId: string) => {
      const res = await fetch("/api/art-gen/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId, skipGenerate: false }),
      });
      if (!res.ok) throw new Error("Falha ao regenerar");
    },
    [demandId]
  );

  const handleAdjust = useCallback(async (jobId: string, instruction: string) => {
    const res = await fetch(`/api/art-gen/${jobId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Falha ao ajustar");
    }
  }, []);

  const handleRestoreVersion = useCallback(
    async (jobId: string, versionId: string) => {
      const res = await fetch(
        `/api/art-gen/${jobId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Falha ao restaurar versão");
    },
    []
  );

  // ------------------------------------------------------------------
  // Cancelar geração
  // ------------------------------------------------------------------

  async function handleCancelGeneration() {
    const res = await fetch("/api/art-gen/cancel-demand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demandId }),
    });
    if (!res.ok) { toast.error("Erro ao cancelar geração"); return; }
    const data = (await res.json()) as { cancelled?: number };
    toast.info(`${data.cancelled ?? 0} job(s) cancelado(s)`);
    setJobs((prev) =>
      prev.map((j) =>
        j.status === "queued" || j.status === "processing"
          ? { ...j, status: "failed" as const, error: "Cancelado pelo operador" }
          : j
      )
    );
  }

  // ------------------------------------------------------------------
  // Download em lote — somente aprovadas
  // ------------------------------------------------------------------

  function handleBatchDownload() {
    const approved = jobs.filter((j) => j.approved && j.currentVersion?.result_url);
    if (approved.length === 0) {
      toast.info("Nenhuma arte aprovada para baixar");
      return;
    }
    for (const job of approved) {
      const url = job.currentVersion!.result_url;
      const a = document.createElement("a");
      a.href = url;
      a.download = `arte-${job.art_index + 1}.png`;
      a.target = "_blank";
      a.click();
    }
    toast.success(`${approved.length} arte(s) baixada(s)`);
  }

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma arte gerada ainda. Clique em &quot;Gerar artes&quot; para iniciar.
      </p>
    );
  }

  const approvedCount = jobs.filter((j) => j.approved).length;
  const activeCount = jobs.filter((j) => j.status === "queued" || j.status === "processing").length;

  return (
    <div className="space-y-4">
      {/* Header com ações em lote */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {jobs.length} arte(s) · {approvedCount} aprovada(s)
          {activeCount > 0 && ` · ${activeCount} gerando`}
        </p>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCancelGeneration()}
              className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              <StopCircle className="size-3.5" />
              Cancelar geração
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchDownload}
            className="gap-2"
          >
            <Download className="size-3.5" />
            Baixar aprovadas
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {jobs.map((job) => (
          <ArtCard
            key={job.id}
            job={job}
            artIndex={job.art_index}
            onApprove={handleApprove}
            onRegenerate={handleRegenerate}
            onAdjust={handleAdjust}
            onRestoreVersion={handleRestoreVersion}
          />
        ))}
      </div>
    </div>
  );
}
