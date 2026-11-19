"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageLightbox, type LightboxItem } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";
import { formatInstagramDate, utcToZonedLocal, zonedLocalToUtcIso } from "@/lib/instagram/schedule";
import { isStale, toAgentRun } from "@/lib/carousel-agent/shape";
import type { AgentCard, AgentFormat, AgentRun, AgentRunStatus } from "@/lib/carousel-agent/types";

const FORMAT: Record<AgentFormat, { label: string; noun: string }> = {
  carousel: { label: "Carrossel", noun: "carrossel" },
  single: { label: "Arte única", noun: "arte" },
  tweet: { label: "Carrossel tweet", noun: "carrossel tweet" },
  studio: { label: "Carrossel Studio", noun: "carrossel" },
};


const STATUS: Record<AgentRunStatus, { label: string; variant: "amber" | "blue" | "green" | "red" | "slate" | "violet" }> = {
  queued: { label: "Na fila", variant: "slate" },
  generating: { label: "Gerando", variant: "blue" },
  awaiting_approval: { label: "Aguardando aprovação", variant: "amber" },
  approved: { label: "Aprovado", variant: "green" },
  rejected: { label: "Reprovado", variant: "red" },
  failed: { label: "Falhou", variant: "red" },
};


async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro inesperado");
  return data;
}

export function AgentRunsBoard({ initialRuns }: { initialRuns: AgentRun[] }) {
  const [runs, setRuns] = useState<AgentRun[]>(initialRuns);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("carousel-agent-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "carousel_agent_runs" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id: string }).id;
          setRuns((prev) => prev.filter((r) => r.id !== id));
          return;
        }
        // O payload do Realtime pode vir sem as colunas grandes (plan, input):
        // busca a linha inteira.
        const id = (payload.new as { id: string }).id;
        supabase
          .from("carousel_agent_runs")
          .select("*")
          .eq("id", id)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) return;
            const run = toAgentRun(data);
            setRuns((prev) => {
              const exists = prev.some((r) => r.id === run.id);
              const next = exists ? prev.map((r) => (r.id === run.id ? run : r)) : [run, ...prev];
              return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
            });
          });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pending = useMemo(
    () => runs.filter((r) => r.status !== "approved" && r.status !== "rejected"),
    [runs]
  );
  const decided = useMemo(
    () => runs.filter((r) => r.status === "approved" || r.status === "rejected"),
    [runs]
  );

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        tone="lime"
        title="Nenhum post do agente ainda"
        description="Quando o agente pedir um carrossel, uma arte ou um carrossel tweet, ele aparece aqui sendo gerado e fica esperando sua aprovação antes de ir para o Instagram."
      />
    );
  }

  const removeRun = (id: string) => setRuns((prev) => prev.filter((r) => r.id !== id));

  const open = (run: AgentRun, index: number) => {
    const items = run.cards
      .filter((c) => c.url)
      .map((c) => ({ url: c.url!, label: `Card ${c.index + 1}`, downloadName: `card-${c.index + 1}.jpg` }));
    const at = items.findIndex((i) => i.label === `Card ${index + 1}`);
    if (at >= 0) setLightbox({ items, index: at });
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Para aprovar <span className="text-muted-foreground">· {pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-muted-foreground">
            Nada esperando aprovação.
          </p>
        ) : (
          pending.map((run) => (
            <RunCard key={run.id} run={run} onOpen={(i) => open(run, i)} onDeleted={removeRun} />
          ))
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Histórico <span className="text-muted-foreground">· {decided.length}</span>
          </h2>
          {decided.map((run) => (
            <RunCard key={run.id} run={run} onOpen={(i) => open(run, i)} onDeleted={removeRun} />
          ))}
        </section>
      )}

      <ImageLightbox
        items={lightbox?.items ?? []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onNavigate={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
      />
    </div>
  );
}

function RunCard({
  run,
  onOpen,
  onDeleted,
}: {
  run: AgentRun;
  onOpen: (index: number) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const status = STATUS[run.status];
  const stale = isStale(run);
  const working = (run.status === "generating" || run.status === "queued") && !stale;
  const canAdjust = run.status === "awaiting_approval" || run.status === "failed";
  const qaWarnings = run.cards.filter((c) => c.qa && !c.qa.ok).length;
  const plannedCards = run.plan?.cards.length ?? run.card_count ?? 0;

  async function remove() {
    const name = run.plan?.title ?? FORMAT[run.format].label;
    const note =
      run.status === "approved"
        ? "\n\nEle já foi aprovado: sai da lista, mas o post continua agendado/publicado no Instagram."
        : "\n\nAs imagens geradas também serão apagadas. Não dá para desfazer.";
    if (!confirm(`Excluir "${name}"?${note}`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/carousel-agent/runs/${run.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir");
      onDeleted(run.id);
      toast.success("Excluído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      setDeleting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-base font-semibold text-foreground">
            <Badge
              variant={run.format === "tweet" ? "blue" : run.format === "single" ? "violet" : run.format === "studio" ? "green" : "lime"}
            >
              {FORMAT[run.format].label}
            </Badge>
            <span className="truncate">
              {run.plan?.title ?? (working ? `Planejando ${run.format === "single" ? "a arte" : "o carrossel"}…` : FORMAT[run.format].label)}
            </span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {run.profile_name} · {run.ig_username ? `@${run.ig_username}` : run.ig_user_id} ·{" "}
            {run.mode === "manual" ? "conteúdo do agente" : "tema"}
            {run.format === "tweet" ? ` · fundo ${run.options.theme === "dark" ? "escuro" : "claro"}` : ""} · pedido em{" "}
            {formatInstagramDate(run.created_at)}
            {run.format === "studio" && run.options.studioCarouselId ? (
              <>
                {" · "}
                <a
                  href={`/carousel/studio/${run.options.studioCarouselId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  Editar no Studio
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {qaWarnings > 0 && run.status === "awaiting_approval" && (
            <Badge variant="amber">
              <AlertTriangle />
              {qaWarnings} card{qaWarnings > 1 ? "s" : ""} para revisar
            </Badge>
          )}
          <Badge variant={stale ? "red" : status.variant}>
            {working && <Loader2 className="animate-spin" />}
            {stale ? "Parou no meio" : status.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir"
            title={working ? "Espere terminar de gerar para excluir" : "Excluir"}
            disabled={working || deleting}
            onClick={remove}
            className="text-muted-foreground hover:text-tone-red"
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </header>

      <div className="space-y-4 px-5 py-4">
        <details className="group text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
            Pedido do agente
          </summary>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs text-muted-foreground">
            {run.input}
          </p>
        </details>

        {/* Cards */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {(run.cards.length
            ? run.cards
            : Array.from({ length: plannedCards || 5 }, (_, i) => ({ index: i, status: "pending" }) as AgentCard)
          ).map((card) => (
            <CardThumb
              key={card.index}
              run={run}
              card={card}
              canAdjust={canAdjust}
              onOpen={() => onOpen(card.index)}
            />
          ))}
        </div>

        {run.caption && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Legenda</p>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">
              {run.caption}
            </p>
          </div>
        )}

        {run.error && (
          <div className="flex items-start gap-2 rounded-xl border border-tone-red/25 bg-tone-red/12 p-3 text-sm text-tone-red">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{run.error}</span>
          </div>
        )}

        {run.status === "awaiting_approval" && <ApproveBar run={run} />}

        {(run.status === "failed" || stale) && <ResumeBar run={run} />}

        {run.status === "approved" && (
          <p className="flex items-center gap-2 text-sm text-tone-green">
            <Check className="size-4" />
            {run.scheduled_at
              ? `Aprovado e agendado para ${formatInstagramDate(run.scheduled_at)} em @${run.ig_username ?? run.ig_user_id}.`
              : `Aprovado e enviado para publicação em @${run.ig_username ?? run.ig_user_id}.`}
          </p>
        )}

        {run.status === "rejected" && (
          <p className="text-sm text-muted-foreground">
            Reprovado{run.decided_at ? ` em ${formatInstagramDate(run.decided_at)}` : ""}
            {run.feedback ? `: “${run.feedback}”` : "."}
          </p>
        )}
      </div>
    </article>
  );
}

function CardThumb({
  run,
  card,
  canAdjust,
  onOpen,
}: {
  run: AgentRun;
  card: AgentCard;
  canAdjust: boolean;
  onOpen: () => void;
}) {
  const [redoOpen, setRedoOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const generating = card.status === "generating" || card.status === "pending";
  const warn = card.qa && !card.qa.ok;

  async function redo() {
    setBusy(true);
    try {
      await postJson(`/api/carousel-agent/runs/${run.id}/regenerate`, {
        cardIndex: card.index,
        instruction: instruction.trim() || null,
      });
      toast.success(`Refazendo o card ${card.index + 1}`);
      setRedoOpen(false);
      setInstruction("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao refazer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-40 shrink-0 space-y-1.5">
      <button
        type="button"
        onClick={onOpen}
        disabled={!card.url}
        className={cn(
          "relative block aspect-[4/5] w-full overflow-hidden rounded-xl border bg-surface",
          warn ? "border-tone-amber/60" : "border-border",
          card.url && "cursor-zoom-in"
        )}
        aria-label={`Ampliar card ${card.index + 1}`}
      >
        {card.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.url} alt={`Card ${card.index + 1}`} className="size-full object-cover" />
        )}
        {generating && run.status === "generating" && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-[0.6875rem] font-medium text-foreground">
            <Loader2 className="size-4 animate-spin" />
            {card.status === "generating" ? `gerando${card.attempts > 1 ? " de novo" : ""}` : "na fila"}
          </span>
        )}
        {card.status === "failed" && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 p-2 text-center text-[0.6875rem] text-tone-red">
            <AlertCircle className="size-4" />
            falhou
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-background/80 px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-foreground">
          {card.index + 1}
        </span>
      </button>

      {warn && (
        <p className="text-[0.6875rem] leading-snug text-tone-amber" title={card.qa!.issues.join("\n")}>
          <AlertTriangle className="mr-0.5 inline size-3" />
          {card.qa!.issues[0]}
        </p>
      )}

      {canAdjust && run.format === "studio" && (
        <button
          type="button"
          onClick={redo}
          disabled={busy}
          title="Desenha o card de novo a partir do Carrossel Studio (pega o que você ajustou no editor)"
          className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-muted-foreground hover:text-foreground"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Atualizar do Studio
        </button>
      )}
      {canAdjust && run.format !== "studio" && !redoOpen && (
        <button
          type="button"
          onClick={() => setRedoOpen(true)}
          className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3" />
          Refazer
        </button>
      )}
      {canAdjust && run.format !== "studio" && redoOpen && (
        <div className="space-y-1.5">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="O que mudar? (opcional)"
            rows={3}
            className="resize-none text-xs"
          />
          <div className="flex gap-1">
            <Button size="xs" onClick={redo} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Refazer
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setRedoOpen(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApproveBar({ run }: { run: AgentRun }) {
  const requested = run.scheduled_at && Date.parse(run.scheduled_at) > Date.now() + 5 * 60_000 ? run.scheduled_at : null;
  const [when, setWhen] = useState(requested ? utcToZonedLocal(requested) : "");
  const [busy, setBusy] = useState<"schedule" | "now" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function approve(now: boolean) {
    const what = run.cards.length === 1 ? "a arte" : `${run.cards.length} cards`;
    if (now && !confirm(`Publicar agora ${what} em @${run.ig_username ?? run.ig_user_id}?`)) return;
    let scheduledAt: string | null = null;
    if (!now) {
      if (!when) {
        toast.error("Escolha a data e hora do post");
        return;
      }
      try {
        scheduledAt = zonedLocalToUtcIso(when);
      } catch {
        toast.error("Data e hora inválidas");
        return;
      }
    }
    setBusy(now ? "now" : "schedule");
    try {
      const data = await postJson(`/api/carousel-agent/runs/${run.id}/approve`, { scheduledAt });
      if (now && data.post?.status === "failed") {
        toast.error(`Aprovado, mas a publicação falhou: ${data.post.error ?? "erro"}`);
      } else {
        toast.success(now ? "Publicado no Instagram" : `Agendado para ${formatInstagramDate(scheduledAt!)}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    try {
      await postJson(`/api/carousel-agent/runs/${run.id}/reject`, { feedback });
      toast.success("Reprovado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reprovar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      {run.scheduled_at && !requested && (
        <p className="text-xs text-tone-amber">
          O agente pediu {formatInstagramDate(run.scheduled_at)}, que já passou ou está perto demais. Escolha outro horário.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Data e hora (Brasília)
          </span>
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-9 w-auto"
          />
        </label>
        <Button onClick={() => approve(false)} disabled={!!busy || !when}>
          {busy === "schedule" ? <Loader2 className="animate-spin" /> : <Check />}
          Aprovar e agendar
        </Button>
        <Button variant="outline" onClick={() => approve(true)} disabled={!!busy}>
          {busy === "now" ? <Loader2 className="animate-spin" /> : <Send />}
          Publicar agora
        </Button>
        {!rejecting && (
          <Button variant="ghost" className="ml-auto text-tone-red" onClick={() => setRejecting(true)} disabled={!!busy}>
            <X />
            Reprovar
          </Button>
        )}
      </div>
      {rejecting && (
        <div className="space-y-2">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Motivo (opcional). Vai de volta para o agente."
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={reject} disabled={!!busy}>
              {busy === "reject" ? <Loader2 className="animate-spin" /> : <X />}
              Confirmar reprovação
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={!!busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumeBar({ run }: { run: AgentRun }) {
  const [busy, setBusy] = useState(false);
  async function resume() {
    setBusy(true);
    try {
      await postJson(`/api/carousel-agent/runs/${run.id}/regenerate`, {});
      toast.success("Retomando a geração");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao retomar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={resume} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Retomar geração
      </Button>
      <span className="text-xs text-muted-foreground">Gera só os cards que não ficaram prontos.</span>
    </div>
  );
}
