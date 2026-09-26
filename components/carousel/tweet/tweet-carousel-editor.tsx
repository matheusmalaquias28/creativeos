"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CloudOff,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  Moon,
  Plus,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TweetCardCanvas, TweetCardPreview } from "@/components/carousel/tweet/tweet-card-canvas";
import { TweetTextEditor } from "@/components/carousel/tweet/tweet-text-editor";
import { useTweetAutosave, type SaveStatus } from "@/components/carousel/tweet/use-tweet-autosave";
import {
  deliverFiles,
  prefersShareSheet,
  renderCardFile,
  shareFilesNow,
} from "@/lib/carousel/tweet/export-client";
import { TWEET_FONT_MAX, TWEET_FONT_MIN } from "@/lib/carousel/tweet/format";
import {
  makeTweetCard,
  type TweetCard,
  type TweetCarousel,
  type TweetProfile,
} from "@/types/tweet-carousel";

function slug(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "carrossel"
  );
}

function StatusPill({ status }: { status: SaveStatus }) {
  const map = {
    saved: { icon: <Check className="size-3.5" />, label: "Salvo", cls: "text-tone-green" },
    pending: { icon: <Loader2 className="size-3.5 animate-spin" />, label: "Salvando…", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, label: "Salvando…", cls: "text-muted-foreground" },
    offline: { icon: <CloudOff className="size-3.5" />, label: "Salvo no aparelho, sincronizando…", cls: "text-tone-amber" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", map.cls)} aria-live="polite">
      {map.icon}
      {map.label}
    </span>
  );
}

async function uploadImage(file: File, kind: "avatar" | "card"): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/carousel/tweet/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? "Falha no upload");
  return data.url as string;
}

export function TweetCarouselEditor({
  carousel,
  profiles,
}: {
  carousel: TweetCarousel;
  profiles: TweetProfile[];
}) {
  const { draft, update, status, restored } = useTweetAutosave(
    carousel.id,
    {
      name: carousel.name,
      theme: carousel.theme,
      cards: carousel.cards,
      profileId: carousel.profile_id,
      profile: carousel.profile,
    },
    carousel.updated_at
  );

  const exportRefs = useRef(new Map<string, HTMLDivElement>());
  const [busy, setBusy] = useState<string | null>(null); // card id | "all"
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  // No servidor sempre "Baixar"; no celular vira "Salvar" (share sheet → Fotos).
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(prefersShareSheet()), []);
  // Remonta os editores de texto quando o conteúdo muda por fora (restauração local).
  const editorEpoch = restored ? 1 : 0;

  const { cards, profile, theme } = draft;
  const allAuto = cards.every((c) => c.fontSize == null);

  function setCard(id: string, patch: Partial<TweetCard>) {
    update((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }

  function insertCard(afterIndex: number, card = makeTweetCard()) {
    update((d) => {
      const next = [...d.cards];
      next.splice(afterIndex + 1, 0, card);
      return { ...d, cards: next };
    });
  }

  function moveCard(index: number, dir: -1 | 1) {
    update((d) => {
      const target = index + dir;
      if (target < 0 || target >= d.cards.length) return d;
      const next = [...d.cards];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, cards: next };
    });
  }

  function removeCard(index: number) {
    const removed = cards[index];
    if (!removed) return;
    update((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== removed.id) }));
    toast("Card excluído", {
      action: {
        label: "Desfazer",
        onClick: () =>
          update((d) => {
            if (d.cards.some((c) => c.id === removed.id)) return d;
            const next = [...d.cards];
            next.splice(Math.min(index, next.length), 0, removed);
            return { ...d, cards: next };
          }),
      },
    });
  }

  async function handleCardImage(cardId: string, file: File | undefined) {
    if (!file) return;
    setUploadingId(cardId);
    try {
      const url = await uploadImage(file, "card");
      setCard(cardId, { imageUrl: url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploadingId(null);
    }
  }

  async function download(targets: TweetCard[], key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const base = slug(draft.name);
      const files: File[] = [];
      for (const card of targets) {
        const node = exportRefs.current.get(card.id);
        if (!node) continue;
        const idx = cards.findIndex((c) => c.id === card.id);
        files.push(await renderCardFile(node, `${base}-${String(idx + 1).padStart(2, "0")}.png`));
      }
      if (files.length === 0) return;
      const result = await deliverFiles(files);
      if (result === "needs-gesture") setPendingFiles(files);
      else if (result === "ok" && !mobile) {
        toast.success(files.length > 1 ? `${files.length} imagens baixadas` : "Imagem baixada");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a imagem");
    } finally {
      setBusy(null);
    }
  }

  function changeProfile(profileId: string) {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    update((d) => ({
      ...d,
      profileId: p.id,
      profile: { name: p.name, handle: p.handle, avatarUrl: p.avatar_url },
    }));
  }

  const profileInList = profiles.some((p) => p.id === draft.profileId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
      {/* Barra superior */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/carousel"
            aria-label="Voltar para carrosséis"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Input
            value={draft.name}
            onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
            aria-label="Nome do carrossel"
            className="h-9 min-w-0 flex-1 border-transparent bg-transparent text-base font-bold shadow-none hover:border-border sm:max-w-sm"
          />
          <StatusPill status={status} />
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => download(cards, "all")}
            disabled={!!busy || cards.length === 0}
          >
            {busy === "all" ? <Loader2 className="animate-spin" /> : <Download />}
            {mobile ? "Salvar todos" : "Baixar todos"}
          </Button>
        </div>

        {/* Ajustes globais — valem para todos os cards */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={profileInList ? draft.profileId ?? "" : ""}
            onChange={(e) => changeProfile(e.target.value)}
            aria-label="Perfil"
            className="h-8 max-w-[14rem] rounded-lg border border-border bg-card px-2 text-[0.8125rem] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {!profileInList && <option value="">{profile.name} ({profile.handle})</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.handle})
              </option>
            ))}
          </select>

          <SegmentedControl
            size="sm"
            aria-label="Tema"
            value={theme}
            onChange={(v) => update((d) => ({ ...d, theme: v }))}
            options={[
              { value: "light", label: "Claro", icon: <Sun className="size-3.5" /> },
              { value: "dark", label: "Escuro", icon: <Moon className="size-3.5" /> },
            ]}
          />

          <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5">
            <span className="text-xs font-semibold text-muted-foreground">Texto (todos)</span>
            <button
              type="button"
              onClick={() => update((d) => ({ ...d, cards: d.cards.map((c) => ({ ...c, fontSize: null })) }))}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold transition-colors",
                allAuto ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Auto
            </button>
            <input
              type="range"
              min={TWEET_FONT_MIN}
              max={64}
              step={2}
              defaultValue={TWEET_FONT_MAX}
              aria-label="Tamanho do texto de todos os cards"
              onChange={(e) => {
                const size = Number(e.target.value);
                update((d) => ({ ...d, cards: d.cards.map((c) => ({ ...c, fontSize: size })) }));
              }}
              className="w-24 accent-primary"
            />
          </div>
        </div>
      </div>

      {restored && (
        <p className="mb-4 rounded-xl border border-tone-amber/25 bg-tone-amber/10 px-3 py-2 text-xs text-tone-amber">
          Recuperamos alterações que não tinham sido enviadas da última vez. Já estamos sincronizando.
        </p>
      )}

      {/* Cards */}
      <ol className="space-y-5">
        {cards.map((card, i) => (
          <li
            key={card.id}
            className="rounded-2xl border border-border bg-card p-3 shadow-[var(--surface-shadow)] sm:p-4"
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,19rem)_1fr]">
              <div className="mx-auto w-full max-w-[19rem]">
                <TweetCardPreview
                  card={card}
                  profile={profile}
                  theme={theme}
                  className="rounded-xl ring-1 ring-border"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center gap-1">
                  <span className="mr-auto rounded-md bg-muted px-2 py-0.5 text-xs font-bold tabular-nums text-foreground">
                    Card {i + 1}/{cards.length}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Mover para cima" disabled={i === 0} onClick={() => moveCard(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Mover para baixo" disabled={i === cards.length - 1} onClick={() => moveCard(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Duplicar card"
                    onClick={() => insertCard(i, makeTweetCard({ html: card.html, imageUrl: card.imageUrl, fontSize: card.fontSize }))}
                  >
                    <Copy />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Excluir card" onClick={() => removeCard(i)}>
                    <Trash2 />
                  </Button>
                </div>

                <TweetTextEditor
                  key={`${card.id}:${editorEpoch}`}
                  html={card.html}
                  onChange={(html) => setCard(card.id, { html })}
                />

                <div className="flex flex-wrap items-center gap-2">
                  {/* Tamanho do texto deste card */}
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5">
                    <span className="text-xs font-semibold text-muted-foreground">Texto</span>
                    <button
                      type="button"
                      onClick={() => setCard(card.id, { fontSize: null })}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold transition-colors",
                        card.fontSize == null ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Auto
                    </button>
                    <input
                      type="range"
                      min={TWEET_FONT_MIN}
                      max={64}
                      step={2}
                      value={card.fontSize ?? TWEET_FONT_MAX}
                      aria-label={`Tamanho do texto do card ${i + 1}`}
                      onChange={(e) => setCard(card.id, { fontSize: Number(e.target.value) })}
                      className="w-24 accent-primary"
                    />
                  </div>

                  {/* Imagem opcional */}
                  {card.imageUrl ? (
                    <Button variant="outline" size="sm" onClick={() => setCard(card.id, { imageUrl: null })}>
                      <X />
                      Remover imagem
                    </Button>
                  ) : (
                    <label
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[0.8125rem] font-medium text-foreground shadow-[var(--surface-shadow)] transition-premium hover:border-border-strong hover:bg-accent",
                        uploadingId === card.id && "pointer-events-none opacity-60"
                      )}
                    >
                      {uploadingId === card.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="size-3.5" />
                      )}
                      Adicionar imagem
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          handleCardImage(card.id, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="sm:ml-auto"
                    disabled={!!busy}
                    onClick={() => download([card], card.id)}
                  >
                    {busy === card.id ? <Loader2 className="animate-spin" /> : <Download />}
                    {mobile ? "Salvar" : "Baixar"}
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Button variant="outline" className="mt-5 w-full" onClick={() => insertCard(cards.length - 1)}>
        <Plus />
        Adicionar card
      </Button>

      {/* Renders em tamanho real, fora da tela, usados na exportação. */}
      <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
        {cards.map((card) => (
          <TweetCardCanvas
            key={card.id}
            ref={(el) => {
              if (el) exportRefs.current.set(card.id, el);
              else exportRefs.current.delete(card.id);
            }}
            card={card}
            profile={profile}
            theme={theme}
          />
        ))}
      </div>

      {/* iOS: a ativação do toque expira durante a renderização — pede um novo toque. */}
      <Dialog open={!!pendingFiles} onOpenChange={(o) => !o && setPendingFiles(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Imagens prontas</DialogTitle>
            <DialogDescription>
              Toque em salvar e escolha <b>Salvar imagem</b> para mandar para a galeria de fotos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingFiles(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                const files = pendingFiles;
                if (!files) return;
                const ok = await shareFilesNow(files);
                if (ok) setPendingFiles(null);
              }}
            >
              <Download />
              Salvar {pendingFiles && pendingFiles.length > 1 ? `${pendingFiles.length} imagens` : "imagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
