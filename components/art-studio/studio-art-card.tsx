"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Maximize2,
  PenLine,
  RefreshCw,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { effectiveStudioPrompt, type ArtFormat, type StudioJob } from "@/lib/art-studio/types";

type Props = {
  job: StudioJob;
  /** URL da imagem a exibir — a arte 3:4 ou a story 9:16. */
  url: string | null;
  format: ArtFormat;
  onOpenFullscreen: (url: string) => void;
  onApprove: (jobId: string, approved: boolean) => Promise<void>;
  onDelete: (jobId: string) => Promise<void>;
  onRegenerate: (jobId: string, prompt: string) => Promise<void>;
};

const ASPECT = { feed: "aspect-[3/4]", story: "aspect-[9/16]" } as const;

type Phase = "writing" | "generating" | "ready" | "failed";

function phaseOf(job: StudioJob, format: ArtFormat): Phase {
  if (format === "story") {
    if (job.story_status === "failed") return "failed";
    if (job.story_status === "succeeded") return "ready";
    return "generating";
  }
  if (job.status === "failed") return "failed";
  if (job.status === "succeeded") return "ready";
  if (job.status === "draft" || job.status === "writing_prompt") return "writing";
  return "generating";
}

const PHASE_LABEL: Record<Phase, string> = {
  writing: "Dirigindo a arte",
  generating: "Gerando a imagem",
  ready: "Pronta",
  failed: "Falhou",
};

/**
 * Um criativo no estúdio.
 *
 * O card mostra a imagem e nada mais até ela existir — o prompt fica atrás do
 * botão "Ajustar prompt" porque, no caminho normal, o operador olha a arte e
 * decide; ler 300 palavras de briefing é a exceção, não a régua.
 */
export function StudioArtCard({
  job,
  url,
  format,
  onOpenFullscreen,
  onApprove,
  onDelete,
  onRegenerate,
}: Props) {
  const initialPrompt = effectiveStudioPrompt(job);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState<"approve" | "delete" | "regenerate" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastPrompt = useRef(initialPrompt);

  // O prompt muda por baixo do editor quando o diretor reescreve a arte.
  // Sincroniza sem pisar numa edição em andamento.
  useEffect(() => {
    const incoming = effectiveStudioPrompt(job);
    if (incoming !== lastPrompt.current) {
      lastPrompt.current = incoming;
      if (!editing) setPrompt(incoming);
    }
  }, [job, editing]);

  const phase = phaseOf(job, format);
  const working = phase === "writing" || phase === "generating";
  const error = format === "story" ? job.story_error : job.error;

  async function run(kind: "approve" | "delete" | "regenerate", fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card transition-premium",
        job.approved
          ? "border-tone-green/40 shadow-[0_0_0_1px_color-mix(in_oklch,var(--tone-green)_20%,transparent)]"
          : "border-border"
      )}
    >
      {/* Imagem */}
      <div className={cn("relative w-full bg-surface", ASPECT[format])}>
        {url ? (
          <>
            <Image
              src={url}
              alt={`Arte ${job.art_index + 1}`}
              fill
              unoptimized
              sizes="(min-width: 1280px) 20rem, (min-width: 768px) 33vw, 50vw"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => onOpenFullscreen(url)}
              aria-label={`Ampliar arte ${job.art_index + 1}`}
              className="transition-premium absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 backdrop-blur-sm hover:opacity-100"
            >
              <Maximize2 className="size-5 text-foreground" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            {phase === "failed" ? (
              <XCircle className="size-5 text-tone-red" />
            ) : (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            )}
            <span className="text-[0.6875rem] font-semibold text-muted-foreground">
              {PHASE_LABEL[phase]}
            </span>
          </div>
        )}

        <span className="absolute top-2 left-2 flex items-center gap-1">
          <Badge variant="secondary" className="tabular-nums">
            {job.art_index + 1}
          </Badge>
          {job.approved && (
            <Badge variant="green" className="gap-1">
              <Check className="size-3" />
              aprovada
            </Badge>
          )}
        </span>
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-2 p-2.5">
        {error && (
          <p className="rounded-lg border border-tone-red/25 bg-tone-red/12 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-tone-red">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {format === "feed" && (
            <Button
              size="xs"
              variant={job.approved ? "secondary" : "positive"}
              disabled={!url || busy !== null || working}
              onClick={() => void run("approve", () => onApprove(job.id, !job.approved))}
            >
              {busy === "approve" ? (
                <Loader2 className="animate-spin" />
              ) : job.approved ? (
                <Undo2 />
              ) : (
                <Check />
              )}
              {job.approved ? "Remover" : "Aprovar"}
            </Button>
          )}

          {format === "feed" && (
            <Button
              size="xs"
              variant="ghost"
              disabled={busy !== null || working}
              onClick={() => setEditing((v) => !v)}
            >
              <PenLine />
              Prompt
            </Button>
          )}

          {url && (
            <Button size="icon-xs" variant="ghost" title="Baixar" render={
              <a
                href={url}
                download={`arte-${job.art_index + 1}${format === "story" ? "-story" : ""}.png`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }>
              <Download />
            </Button>
          )}

          {format === "feed" && (
            <Button
              size="icon-xs"
              variant={confirmDelete ? "destructive" : "ghost"}
              title={confirmDelete ? "Clique de novo para apagar" : "Apagar esta arte"}
              disabled={busy !== null}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  setTimeout(() => setConfirmDelete(false), 4000);
                  return;
                }
                void run("delete", () => onDelete(job.id));
              }}
              className="ml-auto"
            >
              {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          )}
        </div>

        {editing && format === "feed" && (
          <div className="space-y-2 border-t border-border pt-2.5">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              spellCheck={false}
              className="font-mono text-[0.6875rem] leading-relaxed"
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                disabled={busy !== null || !prompt.trim()}
                onClick={() =>
                  void run("regenerate", async () => {
                    await onRegenerate(job.id, prompt);
                    setEditing(false);
                  })
                }
              >
                {busy === "regenerate" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                Regerar com este prompt
              </Button>
              <Button
                size="xs"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => {
                  setPrompt(effectiveStudioPrompt(job));
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
