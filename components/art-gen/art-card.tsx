"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { Download, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Loader2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArtStatusBadge } from "./art-status-badge";
import { ArtVersionStrip } from "./art-version-strip";
import { CopySheet, copyFromParams } from "@/components/art-director/copy-sheet";
import { ART_ASPECT_CLASS } from "@/lib/ai/art-director/constants";
import type { ArtJobWithVersions, ArtVersion } from "@/services/art-gen";

type Props = {
  job: ArtJobWithVersions;
  artIndex: number;
  onApprove: (jobId: string) => Promise<void>;
  onRegenerate: (jobId: string) => Promise<void>;
  onAdjust: (jobId: string, instruction: string) => Promise<void>;
  onRestoreVersion: (jobId: string, versionId: string) => Promise<void>;
  onOpenFullscreen?: (url: string) => void;
};

export function ArtCard({
  job,
  artIndex,
  onApprove,
  onRegenerate,
  onAdjust,
  onRestoreVersion,
  onOpenFullscreen,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [localCurrentVersion, setLocalCurrentVersion] = useState<ArtVersion | null>(
    job.currentVersion
  );
  const [localVersions, setLocalVersions] = useState<ArtVersion[]>(job.versions);
  const [isPending, startTransition] = useTransition();
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Sincroniza estado local quando o job atualiza via Realtime (nova versão chegou)
  useEffect(() => {
    if (!job.currentVersion) return;
    const localNum = localCurrentVersion?.version_number ?? -1;
    if (job.currentVersion.version_number > localNum) {
      setLocalCurrentVersion(job.currentVersion);
      setLocalVersions(job.versions);
    }
  }, [job.currentVersion, job.versions, localCurrentVersion?.version_number]);

  const displayVersion = localCurrentVersion ?? job.currentVersion;
  const hasImage = displayVersion?.result_url != null;

  function handleApprove() {
    startTransition(async () => {
      try {
        await onApprove(job.id);
        toast.success(`Arte ${artIndex + 1} aprovada`);
      } catch {
        toast.error("Erro ao aprovar arte");
      }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      try {
        await onRegenerate(job.id);
        toast.info("Regenerando arte...");
      } catch {
        toast.error("Erro ao regenerar arte");
      }
    });
  }

  async function handleAdjust() {
    if (!instruction.trim()) return;
    setIsAdjusting(true);
    try {
      await onAdjust(job.id, instruction);
      setInstruction("");
      toast.success("Ajuste aplicado");
    } catch {
      toast.error("Erro ao aplicar ajuste");
    } finally {
      setIsAdjusting(false);
    }
  }

  function handleRestoreVersion(version: ArtVersion) {
    startTransition(async () => {
      try {
        await onRestoreVersion(job.id, version.id);
        setLocalCurrentVersion(version);
        setLocalVersions((prev) =>
          prev.map((v) => ({ ...v, is_current: v.id === version.id }))
        );
        toast.success(`Versão ${version.version_number} restaurada`);
      } catch {
        toast.error("Erro ao restaurar versão");
      }
    });
  }

  function handleDownload() {
    if (!displayVersion?.result_url) return;
    const a = document.createElement("a");
    a.href = displayVersion.result_url;
    a.download = `arte-${artIndex + 1}-v${displayVersion.version_number}.png`;
    a.target = "_blank";
    a.click();
  }

  return (
    <>
      {/* Card normal */}
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
          job.approved && "ring-2 ring-primary/40",
          expanded && "ring-2 ring-primary"
        )}
      >
        {/* Thumbnail — 3:4, o formato único da camada */}
        <div className={cn("relative w-full overflow-hidden bg-muted", ART_ASPECT_CLASS)}>
          {hasImage ? (
            <button
              type="button"
              onClick={() => onOpenFullscreen?.(displayVersion!.result_url)}
              className="absolute inset-0 cursor-zoom-in"
              title="Abrir em tela cheia"
            >
              <Image
                src={displayVersion!.result_url}
                alt={`Arte ${artIndex + 1}`}
                fill
                unoptimized
                className="object-cover transition-transform group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              <span className="transition-premium absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 backdrop-blur-sm group-hover:opacity-100">
                <Maximize2 className="size-5 text-foreground" />
              </span>
            </button>
          ) : (
            <div className="flex h-full items-center justify-center">
              {job.status === "processing" || job.status === "queued" ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground/40" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem imagem</span>
              )}
            </div>
          )}

          {/* Status badge */}
          <div className="absolute left-2 top-2">
            <ArtStatusBadge status={job.status as "queued" | "processing" | "succeeded" | "failed"} />
          </div>

          {/* Approved mark */}
          {job.approved && (
            <div className="absolute right-2 top-2">
              <CheckCircle2 className="size-5 text-primary drop-shadow-sm" />
            </div>
          )}
        </div>

        {/* Cola da copy — conferir de memória, 400x por mês, não funciona */}
        <div className="px-2 pt-2">
          <CopySheet copy={copyFromParams(job.params as Record<string, unknown>)} dense />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-1 p-2">
          <span className="text-xs font-medium text-muted-foreground">Arte {artIndex + 1}</span>
          <div className="flex items-center gap-1">
            {hasImage && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleDownload}
                  title="Baixar arte"
                >
                  <Download className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleApprove}
                  disabled={isPending || job.approved}
                  title="Aprovar arte"
                >
                  <CheckCircle2 className="size-3.5" />
                </Button>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={handleRegenerate}
              disabled={isPending}
              title="Regenerar arte"
            >
              <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
            </Button>
            {hasImage && (
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? "Fechar painel" : "Ajustar arte"}
              >
                {expanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Painel inline expandido — ocupa largura total da linha do grid */}
      {expanded && hasImage && (
        <div
          className="col-span-full overflow-hidden rounded-xl border bg-card shadow-md"
          style={{ gridColumn: "1 / -1" }}
        >
          <div className="flex flex-col gap-6 p-6 sm:flex-row">
            {/* Imagem ampliada */}
            <button
              type="button"
              onClick={() => onOpenFullscreen?.(displayVersion!.result_url)}
              className={cn(
                "relative w-full shrink-0 cursor-zoom-in overflow-hidden rounded-lg sm:w-64 lg:w-80",
                ART_ASPECT_CLASS
              )}
              title="Abrir em tela cheia"
            >
              <Image
                src={displayVersion!.result_url}
                alt={`Arte ${artIndex + 1} ampliada`}
                fill
                unoptimized
                className="object-contain"
                sizes="320px"
              />
            </button>

            {/* Controles de ajuste + histórico */}
            <div className="flex flex-1 flex-col gap-4">
              <CopySheet copy={copyFromParams(job.params as Record<string, unknown>)} />

              <div>
                <h3 className="font-heading text-base font-medium">Arte {artIndex + 1}</h3>
                {displayVersion?.instruction && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Último ajuste: {displayVersion.instruction}
                  </p>
                )}
              </div>

              {/* Histórico de versões */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Versões ({localVersions.length})
                </p>
                <ArtVersionStrip
                  versions={localVersions}
                  currentVersionId={localCurrentVersion?.id ?? null}
                  onSelect={handleRestoreVersion}
                />
              </div>

              {/* Instrução de ajuste */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Instrução de ajuste
                </label>
                <Textarea
                  placeholder='Ex: "Deixe o logo maior e o fundo mais escuro"'
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      void handleAdjust();
                    }
                  }}
                />
                <Button
                  onClick={() => void handleAdjust()}
                  disabled={!instruction.trim() || isAdjusting}
                  size="sm"
                  className="self-end"
                >
                  {isAdjusting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  Aplicar ajuste
                </Button>
              </div>

              {/* Ações da versão atual */}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="size-3.5" />
                  Baixar
                </Button>
                <Button
                  size="sm"
                  variant={job.approved ? "secondary" : "default"}
                  onClick={handleApprove}
                  disabled={isPending || job.approved}
                  className="gap-2"
                >
                  <CheckCircle2 className="size-3.5" />
                  {job.approved ? "Aprovada" : "Aprovar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
