"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatInstagramDate,
  MIN_SCHEDULE_LEAD_MS,
  utcToZonedLocal,
  validateScheduledAt,
  zonedLocalToUtcIso,
} from "@/lib/instagram/schedule";
import type { InstagramAccountInfo, InstagramPost } from "@/types/instagram";
import { InstagramPostList } from "./post-history";

const CAPTION_MAX = 2200;
const MAX_CARDS = 10;

export type PublishCard = {
  id: string;
  /** Rótulo embaixo da miniatura (ex.: "Página 2", "Arte 3"). */
  label: string;
  /** Miniatura; recebe a largura de exibição em px. */
  thumb: (width: number) => ReactNode;
};

export type PublishSubmit = {
  ids: string[];
  caption: string;
  /** ISO em UTC, ou null para publicar agora. */
  scheduledAt: string | null;
  account: InstagramAccountInfo;
  setProgress: (message: string) => void;
};

type Step = "edit" | "confirm" | "sending" | "done";

/** Próxima hora cheia com pelo menos 1h de folga, no horário de Brasília. */
function defaultScheduleLocal(): string {
  const at = new Date(Date.now() + 2 * 60 * 60_000);
  at.setUTCMinutes(0, 0, 0);
  return utcToZonedLocal(at);
}

/**
 * Diálogo comum de publicação no Instagram (Studio e demanda): escolhe e
 * ordena os cards, edita a legenda, decide agora ou agendado e confirma.
 * Nada sai sem passar pela tela "Vai publicar N cards em @conta".
 */
export function InstagramPublishShell({
  open,
  onOpenChange,
  accountQuery,
  cards,
  minCards,
  initialCaption,
  blockingError,
  emptyText,
  posts,
  reloadPosts,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Query de /api/instagram/account (ex.: "carouselId=…" ou "demandId=…"). */
  accountQuery: string;
  cards: PublishCard[];
  minCards: number;
  initialCaption: string;
  /** Impede publicar (ex.: formato 9:16). */
  blockingError?: string | null;
  /** Mensagem quando não há nenhum card disponível. */
  emptyText?: string;
  posts: InstagramPost[] | null;
  reloadPosts: () => void;
  onSubmit: (input: PublishSubmit) => Promise<InstagramPost>;
}) {
  const [order, setOrder] = useState<{ id: string; included: boolean }[]>([]);
  const [caption, setCaption] = useState(initialCaption);
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [scheduleLocal, setScheduleLocal] = useState(defaultScheduleLocal);
  const [step, setStep] = useState<Step>("edit");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<InstagramPost | null>(null);
  const [account, setAccount] = useState<InstagramAccountInfo | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Ao abrir: estado novo a partir do conteúdo atual.
  useEffect(() => {
    if (!open) return;
    setOrder(cards.map((c, i) => ({ id: c.id, included: i < MAX_CARDS })));
    setCaption(initialCaption);
    setWhen("now");
    setScheduleLocal(defaultScheduleLocal());
    setStep("edit");
    setResult(null);
    setAccount(null);
    setAccountError(null);
    let canceled = false;
    fetch(`/api/instagram/account?${accountQuery}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Não foi possível ler a conta do Instagram");
        if (!canceled) setAccount(data as InstagramAccountInfo);
      })
      .catch((e) => !canceled && setAccountError(e instanceof Error ? e.message : "Conta indisponível"));
    return () => {
      canceled = true;
    };
    // Só ao abrir: mudanças no conteúdo com o diálogo aberto não resetam a escolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const chosen = order.filter((c) => c.included && cardById.has(c.id));
  const scheduledIso = useMemo(() => {
    if (when !== "schedule") return null;
    try {
      return zonedLocalToUtcIso(scheduleLocal);
    } catch {
      return "invalid";
    }
  }, [when, scheduleLocal]);

  const problems: string[] = [];
  if (blockingError) problems.push(blockingError);
  if (chosen.length < minCards) problems.push(minCards === 1 ? "Escolha pelo menos uma arte." : `Escolha pelo menos ${minCards} cards.`);
  if (chosen.length > MAX_CARDS) problems.push(`O Instagram aceita no máximo ${MAX_CARDS} imagens.`);
  if (caption.length > CAPTION_MAX) problems.push(`A legenda passa de ${CAPTION_MAX} caracteres.`);
  if (scheduledIso === "invalid") problems.push("Data e hora inválidas.");
  else if (scheduledIso) {
    const err = validateScheduledAt(scheduledIso);
    if (err) problems.push(err);
  }
  if (!account) problems.push(accountError ?? "Carregando a conta do Instagram…");

  const move = (index: number, delta: number) =>
    setOrder((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const toggle = (index: number) =>
    setOrder((prev) => {
      if (!prev[index].included && prev.filter((c) => c.included).length >= MAX_CARDS) {
        toast.warning(`No máximo ${MAX_CARDS} imagens`);
        return prev;
      }
      return prev.map((c, i) => (i === index ? { ...c, included: !c.included } : c));
    });

  const send = async () => {
    if (!account || problems.length) return;
    setStep("sending");
    try {
      const post = await onSubmit({ ids: chosen.map((c) => c.id), caption, scheduledAt: scheduledIso, account, setProgress });
      setResult(post);
      setStep("done");
      reloadPosts();
      if (post.status === "published") toast.success("Publicado no Instagram");
      else if (post.status === "scheduled" && post.scheduled_at) toast.success(`Agendado para ${formatInstagramDate(post.scheduled_at)}`);
      else toast.error(post.error ?? "A publicação falhou");
    } catch (e) {
      setStep("confirm");
      toast.error(e instanceof Error ? e.message : "Falha ao publicar");
    }
  };

  const sending = step === "sending";
  const target = account ? `@${account.username ?? account.igUserId}` : "…";
  const kind = chosen.length === 1 ? "1 imagem" : `${chosen.length} cards`;

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Publicar no Instagram</DialogTitle>
          <DialogDescription>
            {accountError ? (
              <span className="text-tone-red">{accountError}</span>
            ) : (
              <>
                Conta de destino: <strong className="text-foreground">{target}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "edit" ? (
          <DialogBody className="space-y-5">
            {blockingError ? (
              <p className="rounded-lg border border-tone-red/25 bg-tone-red/10 px-3 py-2 text-sm text-tone-red">{blockingError}</p>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">Imagens</span>
                <span className="text-xs text-muted-foreground">
                  {chosen.length} de até {MAX_CARDS} · clique para incluir ou tirar, use as setas para ordenar
                  {minCards === 1 ? " · 1 imagem = post simples, 2 ou mais = carrossel" : ""}
                </span>
              </div>
              {cards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
              ) : (
                <ol className="flex gap-2 overflow-x-auto pb-2">
                  {order.map((entry, index) => {
                    const card = cardById.get(entry.id);
                    if (!card) return null;
                    const position = entry.included ? chosen.findIndex((c) => c.id === entry.id) + 1 : null;
                    return (
                      <li key={entry.id} className="flex shrink-0 flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggle(index)}
                          className={cn(
                            "relative overflow-hidden rounded-lg border-2 transition-opacity",
                            entry.included ? "border-primary" : "border-transparent opacity-40"
                          )}
                          title={entry.included ? "Tirar do post" : "Incluir no post"}
                        >
                          {card.thumb(88)}
                          <span
                            className={cn(
                              "absolute top-1 left-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                              entry.included ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
                            )}
                          >
                            {position ?? "–"}
                          </span>
                        </button>
                        <span className="text-[10px] text-muted-foreground">{card.label}</span>
                        <div className="flex gap-0.5">
                          <Button size="icon-xs" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} title="Mover para a esquerda">
                            <ArrowLeft />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={index === order.length - 1}
                            onClick={() => move(index, 1)}
                            title="Mover para a direita"
                          >
                            <ArrowRight />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium" htmlFor="ig-caption">
                  Legenda
                </label>
                <span className={cn("text-xs tabular-nums", caption.length > CAPTION_MAX ? "text-tone-red" : "text-muted-foreground")}>
                  {caption.length.toLocaleString("pt-BR")} / {CAPTION_MAX.toLocaleString("pt-BR")}
                </span>
              </div>
              <Textarea id="ig-caption" rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Quando publicar</span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="ig-when" checked={when === "now"} onChange={() => setWhen("now")} /> Agora
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="ig-when" checked={when === "schedule"} onChange={() => setWhen("schedule")} /> Agendar
                </label>
                {when === "schedule" ? (
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="datetime-local"
                      value={scheduleLocal}
                      min={utcToZonedLocal(Date.now() + MIN_SCHEDULE_LEAD_MS)}
                      onChange={(e) => setScheduleLocal(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-card px-2 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">horário de Brasília</span>
                  </span>
                ) : null}
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Histórico{posts?.length ? ` (${posts.length})` : ""}</summary>
              <div className="mt-2">
                <InstagramPostList posts={posts} onChanged={reloadPosts} />
              </div>
            </details>
          </DialogBody>
        ) : step === "done" && result ? (
          <DialogBody className="space-y-3">
            {result.status === "published" ? (
              <p className="text-sm">
                Publicado em <strong>{target}</strong>.{" "}
                {result.permalink ? (
                  <a href={result.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                    Ver post <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </p>
            ) : result.status === "scheduled" && result.scheduled_at ? (
              <p className="text-sm">
                Agendado para <strong>{formatInstagramDate(result.scheduled_at)}</strong> (horário de Brasília) em{" "}
                <strong>{target}</strong>. Dá para cancelar no histórico abaixo até a hora de publicar.
              </p>
            ) : (
              <p className="text-sm text-tone-red">{result.error ?? "A publicação falhou."}</p>
            )}
            <InstagramPostList posts={posts} onChanged={reloadPosts} />
          </DialogBody>
        ) : (
          <DialogBody className="space-y-4">
            <p className="text-base font-medium">
              {scheduledIso ? (
                <>
                  Vai agendar <strong>{kind}</strong> em <strong>{target}</strong> para{" "}
                  <strong>{formatInstagramDate(scheduledIso)}</strong> (horário de Brasília).
                </>
              ) : (
                <>
                  Vai publicar <strong>{kind}</strong> em <strong>{target}</strong> agora.
                </>
              )}
            </p>
            <ol className="flex gap-2 overflow-x-auto pb-1">
              {chosen.map((entry, i) => {
                const card = cardById.get(entry.id);
                if (!card) return null;
                return (
                  <li key={entry.id} className="relative shrink-0 overflow-hidden rounded-md">
                    {card.thumb(72)}
                    <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
              {caption.trim() ? caption : <span className="text-muted-foreground">Sem legenda</span>}
            </div>
            {sending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {progress}
              </p>
            ) : null}
          </DialogBody>
        )}

        <DialogFooter>
          {step === "edit" ? (
            <>
              {problems.length ? <span className="mr-auto text-xs text-muted-foreground">{problems[0]}</span> : null}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={problems.length > 0} onClick={() => setStep("confirm")}>
                {when === "schedule" ? <CalendarClock /> : <Megaphone />}
                {when === "schedule" ? "Agendar" : "Publicar agora"}
              </Button>
            </>
          ) : step === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="ghost" disabled={sending} onClick={() => setStep("edit")}>
                Voltar
              </Button>
              <Button disabled={sending || problems.length > 0} onClick={send}>
                {sending ? <Loader2 className="animate-spin" /> : scheduledIso ? <CalendarClock /> : <Megaphone />}
                {scheduledIso ? "Confirmar agendamento" : `Publicar em ${target}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
