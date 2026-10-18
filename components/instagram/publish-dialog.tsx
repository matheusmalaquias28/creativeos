"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
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
import { FrameRenderer, FrameThumbnail } from "@/components/carousel-studio/frame-renderer";
import { feedFormatError } from "@/lib/instagram/format";
import {
  formatInstagramDate,
  MIN_SCHEDULE_LEAD_MS,
  utcToZonedLocal,
  validateScheduledAt,
  zonedLocalToUtcIso,
} from "@/lib/instagram/schedule";
import type { StudioDocument } from "@/types/carousel-studio";
import type { InstagramAccountInfo, InstagramPost } from "@/types/instagram";
import { renderNodeToJpeg } from "./render";
import { InstagramPostList, useInstagramPosts } from "./post-history";

const MIN_CARDS = 2;
const MAX_CARDS = 10;
const CAPTION_MAX = 2200;
const BUCKET = "instagram-posts";

type Card = { pageId: string; included: boolean };
type Step = "edit" | "confirm" | "sending" | "done";

/** Próxima hora cheia com pelo menos 1h de folga, no horário de Brasília. */
function defaultScheduleLocal(): string {
  const at = new Date(Date.now() + 2 * 60 * 60_000);
  at.setUTCMinutes(0, 0, 0);
  return utcToZonedLocal(at);
}

/**
 * "Publicar no Instagram": escolhe e ordena os cards, edita a legenda, decide
 * agora ou agendado e confirma. Os cards são renderizados aqui mesmo, com o
 * FrameRenderer do Studio, e sobem em JPEG para o bucket `instagram-posts`.
 * Nada publica sem passar pela tela de confirmação.
 */
export function InstagramPublishDialog({
  open,
  onOpenChange,
  carouselId,
  doc,
  initialCaption,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carouselId: string;
  /** Documento com as alturas de texto medidas (o mesmo da exportação PNG). */
  doc: StudioDocument;
  initialCaption: string;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [caption, setCaption] = useState(initialCaption);
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [scheduleLocal, setScheduleLocal] = useState(defaultScheduleLocal);
  const [step, setStep] = useState<Step>("edit");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<InstagramPost | null>(null);
  const [account, setAccount] = useState<InstagramAccountInfo | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [rendering, setRendering] = useState<string[] | null>(null);
  const renderRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { posts, reload } = useInstagramPosts(carouselId);

  // Ao abrir: estado novo a partir do Studio atual.
  useEffect(() => {
    if (!open) return;
    setCards(doc.pages.map((p, i) => ({ pageId: p.id, included: i < MAX_CARDS })));
    setCaption(initialCaption);
    setWhen("now");
    setScheduleLocal(defaultScheduleLocal());
    setStep("edit");
    setResult(null);
    setAccount(null);
    setAccountError(null);
    let canceled = false;
    fetch(`/api/instagram/account?carouselId=${carouselId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Não foi possível ler a conta do Instagram");
        if (!canceled) setAccount(data as InstagramAccountInfo);
      })
      .catch((e) => !canceled && setAccountError(e instanceof Error ? e.message : "Conta indisponível"));
    return () => {
      canceled = true;
    };
    // Só ao abrir: edições no Studio com o diálogo aberto não resetam a escolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pageById = useMemo(() => new Map(doc.pages.map((p) => [p.id, p])), [doc.pages]);
  const pageNumber = useMemo(() => new Map(doc.pages.map((p, i) => [p.id, i + 1])), [doc.pages]);
  const chosen = cards.filter((c) => c.included && pageById.has(c.pageId));
  const formatError = feedFormatError(doc.format);
  const scheduledIso = useMemo(() => {
    if (when !== "schedule") return null;
    try {
      return zonedLocalToUtcIso(scheduleLocal);
    } catch {
      return "invalid";
    }
  }, [when, scheduleLocal]);

  const problems: string[] = [];
  if (formatError) problems.push(formatError);
  if (chosen.length < MIN_CARDS) problems.push(`Escolha pelo menos ${MIN_CARDS} cards.`);
  if (chosen.length > MAX_CARDS) problems.push(`O Instagram aceita no máximo ${MAX_CARDS} cards.`);
  if (caption.length > CAPTION_MAX) problems.push(`A legenda passa de ${CAPTION_MAX} caracteres.`);
  if (scheduledIso === "invalid") problems.push("Data e hora inválidas.");
  else if (scheduledIso) {
    const err = validateScheduledAt(scheduledIso);
    if (err) problems.push(err);
  }
  if (!account) problems.push(accountError ?? "Carregando a conta do Instagram…");

  const move = (index: number, delta: number) =>
    setCards((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const toggle = (index: number) =>
    setCards((prev) => {
      if (!prev[index].included && prev.filter((c) => c.included).length >= MAX_CARDS) {
        toast.warning(`No máximo ${MAX_CARDS} cards`);
        return prev;
      }
      return prev.map((c, i) => (i === index ? { ...c, included: !c.included } : c));
    });

  const send = async () => {
    if (!account || problems.length) return;
    const pageIds = chosen.map((c) => c.pageId);
    setStep("sending");
    try {
      // 1. Renderiza os cards fora da tela, em tamanho real.
      setProgress("Preparando os cards…");
      setRendering(pageIds);
      await new Promise((r) => setTimeout(r, 150));
      const blobs: Blob[] = [];
      for (const [i, pageId] of pageIds.entries()) {
        setProgress(`Gerando card ${i + 1} de ${pageIds.length}…`);
        const node = renderRefs.current.get(pageId);
        if (!node) throw new Error("Página não renderizada");
        blobs.push(await renderNodeToJpeg(node, doc.width, doc.height));
      }
      setRendering(null);

      // 2. Sobe direto no Storage com URL assinada.
      setProgress("Enviando as imagens…");
      const targetRes = await fetch("/api/instagram/posts/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carouselId, count: blobs.length }),
      });
      const upload = await targetRes.json().catch(() => ({}));
      if (!targetRes.ok) throw new Error(upload.error ?? "Não foi possível preparar o envio");
      const targets = upload.targets as { path: string; token: string }[];
      const supabase = createBrowserSupabase();
      for (const [i, blob] of blobs.entries()) {
        setProgress(`Enviando card ${i + 1} de ${blobs.length}…`);
        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(targets[i].path, targets[i].token, blob, { contentType: "image/jpeg" });
        if (error) throw new Error(`Falha no upload do card ${i + 1}: ${error.message}`);
      }

      // 3. Cria o post (e publica, se for agora).
      setProgress(scheduledIso ? "Agendando…" : "Publicando no Instagram… pode levar até 1 minuto.");
      const res = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: upload.postId,
          carouselId,
          items: targets.map((t, i) => ({ path: t.path, page_id: pageIds[i] })),
          caption,
          scheduledAt: scheduledIso,
          igUserId: account.igUserId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o post");
      const post = data.post as InstagramPost;
      setResult(post);
      setStep("done");
      reload();
      if (post.status === "published") toast.success("Publicado no Instagram");
      else if (post.status === "scheduled" && post.scheduled_at) toast.success(`Agendado para ${formatInstagramDate(post.scheduled_at)}`);
      else toast.error(post.error ?? "A publicação falhou");
    } catch (e) {
      setRendering(null);
      setStep("confirm");
      toast.error(e instanceof Error ? e.message : "Falha ao publicar");
    }
  };

  const sending = step === "sending";
  const target = account ? `@${account.username ?? account.igUserId}` : "…";

  return (
    <>
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
              {formatError ? (
                <p className="rounded-lg border border-tone-red/25 bg-tone-red/10 px-3 py-2 text-sm text-tone-red">{formatError}</p>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Cards</span>
                  <span className="text-xs text-muted-foreground">
                    {chosen.length} de até {MAX_CARDS} · clique para incluir ou tirar, use as setas para ordenar
                  </span>
                </div>
                <ol className="flex gap-2 overflow-x-auto pb-2">
                  {cards.map((card, index) => {
                    const page = pageById.get(card.pageId);
                    if (!page) return null;
                    const position = card.included ? chosen.findIndex((c) => c.pageId === card.pageId) + 1 : null;
                    return (
                      <li key={card.pageId} className="flex shrink-0 flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggle(index)}
                          className={cn(
                            "relative rounded-lg border-2 transition-opacity",
                            card.included ? "border-primary" : "border-transparent opacity-40"
                          )}
                          title={card.included ? "Tirar do post" : "Incluir no post"}
                        >
                          <FrameThumbnail page={page} width={doc.width} height={doc.height} displayWidth={88} className="rounded-md" />
                          <span
                            className={cn(
                              "absolute top-1 left-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                              card.included ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
                            )}
                          >
                            {position ?? "–"}
                          </span>
                        </button>
                        <span className="text-[10px] text-muted-foreground">Página {pageNumber.get(card.pageId)}</span>
                        <div className="flex gap-0.5">
                          <Button size="icon-xs" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} title="Mover para a esquerda">
                            <ArrowLeft />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={index === cards.length - 1}
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
                <summary className="cursor-pointer text-muted-foreground">
                  Histórico deste carrossel{posts?.length ? ` (${posts.length})` : ""}
                </summary>
                <div className="mt-2">
                  <InstagramPostList posts={posts} onChanged={reload} />
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
              <InstagramPostList posts={posts} onChanged={reload} />
            </DialogBody>
          ) : (
            <DialogBody className="space-y-4">
              <p className="text-base font-medium">
                {scheduledIso ? (
                  <>
                    Vai agendar <strong>{chosen.length} cards</strong> em <strong>{target}</strong> para{" "}
                    <strong>{formatInstagramDate(scheduledIso)}</strong> (horário de Brasília).
                  </>
                ) : (
                  <>
                    Vai publicar <strong>{chosen.length} cards</strong> em <strong>{target}</strong> agora.
                  </>
                )}
              </p>
              <ol className="flex gap-2 overflow-x-auto pb-1">
                {chosen.map((card, i) => {
                  const page = pageById.get(card.pageId);
                  if (!page) return null;
                  return (
                    <li key={card.pageId} className="relative shrink-0">
                      <FrameThumbnail page={page} width={doc.width} height={doc.height} displayWidth={72} className="rounded-md" />
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

      {/* Cards fora da tela, em tamanho real, só enquanto gera os JPEGs. */}
      {rendering ? (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          {rendering.map((pageId) => {
            const page = pageById.get(pageId);
            if (!page) return null;
            return (
              <div
                key={pageId}
                ref={(el) => {
                  if (el) renderRefs.current.set(pageId, el);
                  else renderRefs.current.delete(pageId);
                }}
                style={{ width: doc.width, height: doc.height }}
              >
                <FrameRenderer page={page} width={doc.width} height={doc.height} exporting />
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
