"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Maximize2, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ART_ASPECT_CLASS } from "@/lib/ai/art-director/constants";
import { PromptStatusBadge } from "./prompt-status-badge";
import { ReferenceStrip } from "./reference-strip";
import { CopySheet, copyFromParams } from "./copy-sheet";
import type { PromptJob } from "@/services/art-director";

const AUTOSAVE_DELAY_MS = 900;

type Props = {
  job: PromptJob;
  artUrl: string | null;
  hasClientPhotos: boolean;
  onLocalChange: (jobId: string, patch: Partial<PromptJob>) => void;
  onOpenFullscreen: (jobId: string) => void;
};

export function PromptCard({
  job,
  artUrl,
  hasClientPhotos,
  onLocalChange,
  onOpenFullscreen,
}: Props) {
  const initial = job.prompt_edited ?? job.prompt_draft ?? "";
  const [prompt, setPrompt] = useState(initial);
  const [steer, setSteer] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"approve" | "redirect" | "photos" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initial);

  // Regenerar troca o rascunho por baixo do editor — sincroniza sem pisar numa
  // edição em andamento.
  useEffect(() => {
    const incoming = job.prompt_edited ?? job.prompt_draft ?? "";
    if (incoming !== lastSaved.current) {
      lastSaved.current = incoming;
      setPrompt(incoming);
    }
  }, [job.prompt_draft, job.prompt_edited]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function scheduleSave(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(value), AUTOSAVE_DELAY_MS);
  }

  async function save(value: string) {
    if (value.trim() === lastSaved.current.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/art-gen/${job.id}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Erro ao salvar o prompt");
        return;
      }
      lastSaved.current = value;
    } catch {
      toast.error("Erro ao salvar o prompt");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (timer.current) clearTimeout(timer.current);
    await save(prompt);

    setBusy("approve");
    try {
      const res = await fetch(`/api/art-gen/${job.id}/approve-prompt`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao aprovar");
        return;
      }
      onLocalChange(job.id, { status: "queued" });
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setBusy(null);
    }
  }

  async function handleRedirect() {
    setBusy("redirect");
    try {
      const res = await fetch(`/api/art-gen/${job.id}/redirect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steer: steer.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao regenerar");
        return;
      }
      setSteer("");
    } catch {
      toast.error("Erro ao regenerar");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleClientPhotos() {
    const next = !job.use_client_photos;
    setBusy("photos");
    try {
      const res = await fetch(`/api/art-gen/${job.id}/client-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao mudar as fotos do cliente");
        return;
      }
      onLocalChange(job.id, { use_client_photos: next });
      toast.success(
        next ? "Cena reescrita com a pessoa real" : "Cena reescrita sem a foto do cliente"
      );
    } catch {
      toast.error("Erro ao mudar as fotos do cliente");
    } finally {
      setBusy(null);
    }
  }

  const copy = copyFromParams(job.params);
  const editable = job.status === "awaiting_approval";
  const writing = job.status === "writing_prompt" || job.status === "draft";
  const generating = job.status === "queued" || job.status === "processing";
  const edited = Boolean(job.prompt_edited);

  return (
    <Surface padding="md" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            Arte {job.art_index + 1}
          </span>
          <PromptStatusBadge status={job.status} />
          {edited && <Badge variant="secondary">editado</Badge>}
          {job.use_client_photos && (
            <Badge variant="positive" className="gap-1">
              <UserRound className="size-3" />
              foto do cliente
            </Badge>
          )}
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            salvando
          </span>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-4">
          {writing ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <>
              {job.direction?.concept && (
                <div className="space-y-1 rounded-xl border border-border/60 bg-muted/40 p-3.5 dark:border-white/6 dark:bg-white/3">
                  <p className="text-sm leading-snug text-foreground">
                    {job.direction.concept}
                  </p>
                  {job.direction.differentiator && (
                    <p className="text-xs leading-snug text-muted-foreground">
                      {job.direction.differentiator}
                    </p>
                  )}
                </div>
              )}

              <Textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  scheduleSave(e.target.value);
                }}
                disabled={!editable}
                rows={10}
                spellCheck={false}
                className="font-mono text-xs leading-relaxed"
              />

              <ReferenceStrip
                jobId={job.id}
                references={job.references}
                editable={editable}
                onRemoved={(referenceId) =>
                  onLocalChange(job.id, {
                    references: job.references.filter((r) => r.id !== referenceId),
                  })
                }
              />

              {job.error && <p className="text-xs text-negative">{job.error}</p>}
            </>
          )}
        </div>

        {/* Coluna direita: a copy do briefing e a arte quando ela chega */}
        <aside className="space-y-3">
          <CopySheet copy={copy} dense />

          {(artUrl || generating) && (
            <button
              type="button"
              onClick={() => artUrl && onOpenFullscreen(job.id)}
              disabled={!artUrl}
              className={cn(
                "group/art relative w-full overflow-hidden rounded-xl border border-border dark:border-white/8",
                ART_ASPECT_CLASS,
                artUrl ? "cursor-zoom-in" : "cursor-default"
              )}
            >
              {artUrl ? (
                <>
                  <Image
                    src={artUrl}
                    alt={`Arte ${job.art_index + 1}`}
                    fill
                    unoptimized
                    sizes="256px"
                    className="object-cover"
                  />
                  <span className="transition-premium absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-sm group-hover/art:opacity-100">
                    <Maximize2 className="size-5 text-foreground" />
                  </span>
                </>
              ) : (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/40 dark:bg-white/3">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <span className="text-[0.6875rem] text-muted-foreground">gerando…</span>
                </span>
              )}
            </button>
          )}
        </aside>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 dark:border-white/6">
          <Button onClick={() => void handleApprove()} disabled={busy !== null} className="gap-2">
            {busy === "approve" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Aprovar e gerar
          </Button>

          <Input
            value={steer}
            onChange={(e) => setSteer(e.target.value)}
            placeholder="mais minimalista, sem pessoas, fundo claro…"
            className="h-9 max-w-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && busy === null) void handleRedirect();
            }}
          />
          <Button
            variant="ghost"
            onClick={() => void handleRedirect()}
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === "redirect" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Regenerar
          </Button>

          {hasClientPhotos && (
            <Button
              variant={job.use_client_photos ? "secondary" : "ghost"}
              onClick={() => void handleToggleClientPhotos()}
              disabled={busy !== null}
              className="gap-2"
              title="Reescreve a cena contando com a pessoa real das fotos do cliente"
            >
              {busy === "photos" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserRound className="size-4" />
              )}
              {job.use_client_photos ? "Sem foto do cliente" : "Usar foto do cliente"}
            </Button>
          )}
        </div>
      )}

      {generating && !artUrl && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3" />
          Aprovado — a arte aparece aqui assim que ficar pronta.
        </p>
      )}
    </Surface>
  );
}
