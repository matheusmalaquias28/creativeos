"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, ImagePlus, LayoutTemplate, Loader2, PenTool, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/components/ui/surface";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { SectionHeader } from "@/components/layout/section-header";
import type { CarouselStyle, CarouselStyleImage, StyleTemplateSummary } from "@/services/carousel-styles";
import { FrameThumbnail } from "@/components/carousel-studio/frame-renderer";
import { STUDIO_SLOT_LABEL, STUDIO_TEMPLATE_ROLE_LABEL, isStudioBusy } from "@/types/carousel-studio";
import { StyleDnaView } from "./style-dna-view";
import { StyleStatusBadge } from "./style-status-badge";

const UPLOAD_CONCURRENCY = 3;

const ROLE_OPTIONS: Array<{ value: CarouselStyleImage["role"] | ""; label: string }> = [
  { value: "", label: "Auto" },
  { value: "cover", label: "Capa" },
  { value: "inner", label: "Miolo" },
  { value: "cta", label: "CTA" },
];

const selectClass =
  "h-8 w-full rounded-lg border border-border bg-input px-2 text-xs text-foreground outline-none transition-premium hover:border-border-strong focus-visible:border-primary/60 [&>option]:bg-popover [&>option]:text-popover-foreground";

export function StyleEditor({
  initialStyle,
  clients,
  template,
}: {
  initialStyle: CarouselStyle;
  clients: { id: string; name: string }[];
  template: StyleTemplateSummary | null;
}) {
  const router = useRouter();
  const [style, setStyle] = useState(initialStyle);
  const [name, setName] = useState(initialStyle.name);
  const [description, setDescription] = useState(initialStyle.description ?? "");
  const [pending, setPending] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  // Artes mudaram depois da última análise → o DNA não reflete o conjunto.
  const [changedSinceAnalysis, setChangedSinceAnalysis] = useState(
    () =>
      initialStyle.analysis_status === "ready" &&
      !!initialStyle.analyzed_at &&
      initialStyle.images.some((i) => i.created_at > initialStyle.analyzed_at!)
  );

  const images = style.images;

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/carousel/styles/${style.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Falha ao salvar");
      return;
    }
    setStyle(data.style);
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    // Ordem do carrossel = ordem do nome do arquivo (card-1, card-2…).
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    const base = images.reduce((max, i) => Math.max(max, i.position), -1) + 1;
    const queue = sorted.map((file, index) => ({ file, position: base + index }));
    setPending((n) => n + files.length);

    const uploaded: CarouselStyleImage[] = [];
    async function worker() {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("position", String(item.position));
          const res = await fetch(`/api/carousel/styles/${style.id}/images`, { method: "POST", body: formData });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? `Falha no upload de ${item.file.name}`);
          uploaded.push(body.image);
          setStyle((s) => ({ ...s, images: [...s.images, body.image].sort((a, b) => a.position - b.position) }));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Falha no upload de ${item.file.name}`);
        } finally {
          setPending((n) => n - 1);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, sorted.length) }, worker));
    if (uploaded.length > 0) {
      setChangedSinceAnalysis(true);
      toast.success(`${uploaded.length} arte(s) adicionada(s)`);
    }
  }

  async function removeImage(image: CarouselStyleImage) {
    if (!confirm("Remover esta arte do estilo?")) return;
    setStyle((s) => ({ ...s, images: s.images.filter((i) => i.id !== image.id) }));
    const res = await fetch(`/api/carousel/styles/${style.id}/images?imageId=${encodeURIComponent(image.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Falha ao remover");
      setStyle((s) => ({ ...s, images: [...s.images, image].sort((a, b) => a.position - b.position) }));
      return;
    }
    setChangedSinceAnalysis(true);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((image, position) => ({ ...image, position }));
    setStyle((s) => ({ ...s, images: renumbered }));
    setChangedSinceAnalysis(true);
    void patch({ images: renumbered.map((i) => ({ id: i.id, position: i.position })) });
  }

  function setRole(image: CarouselStyleImage, role: CarouselStyleImage["role"]) {
    setStyle((s) => ({ ...s, images: s.images.map((i) => (i.id === image.id ? { ...i, role } : i)) }));
    setChangedSinceAnalysis(true);
    void patch({ images: [{ id: image.id, role }] });
  }

  async function analyze() {
    setAnalyzing(true);
    setStyle((s) => ({ ...s, analysis_status: "analyzing" }));
    try {
      const res = await fetch(`/api/carousel/styles/${style.id}/analyze`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (body.style) setStyle(body.style);
      if (!res.ok) throw new Error(body.error ?? "Falha na análise");
      setChangedSinceAnalysis(false);
      toast.success("DNA do estilo pronto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise");
    } finally {
      setAnalyzing(false);
    }
  }

  const [startingTemplates, setStartingTemplates] = useState(false);

  async function draftTemplates(replace: boolean) {
    if (replace && !confirm("Remontar as páginas-modelo do zero? Os ajustes feitos no editor serão perdidos.")) return;
    setStartingTemplates(true);
    try {
      const res = await fetch(`/api/carousel/styles/${style.id}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Não foi possível montar as páginas-modelo");
      // O editor mostra o progresso do rascunho ao vivo.
      router.push(`/carousel/studio/${body.templateId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      setStartingTemplates(false);
    }
  }

  async function removeStyle() {
    if (!confirm(`Excluir o estilo "${style.name}"? Carrosséis já gerados não mudam.`)) return;
    const res = await fetch(`/api/carousel/styles/${style.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Falha ao excluir");
      return;
    }
    router.push("/carousel/estilos");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Surface padding="md" className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_16rem]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome do estilo</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name.trim() !== style.name) void patch({ name });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cliente (opcional)</label>
            <select
              value={style.client_id ?? ""}
              onChange={(e) => void patch({ client_id: e.target.value || null })}
              className="h-10 w-full rounded-xl border border-border bg-input px-3.5 text-sm text-foreground outline-none transition-premium hover:border-border-strong focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/20 [&>option]:bg-popover [&>option]:text-popover-foreground"
            >
              <option value="">Qualquer cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notas para a IA (opcional)</label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (style.description ?? "")) {
                void patch({ description });
                setChangedSinceAnalysis(style.analysis_status === "ready");
              }
            }}
            placeholder="O que a IA deve notar e manter (ex.: número grande no canto de cada card, fotos P&B)"
          />
        </div>
      </Surface>

      <section className="space-y-4">
        <SectionHeader
          icon={ImagePlus}
          tone="lime"
          title="Artes do estilo"
          description="As artes de um carrossel de exemplo, na ordem. Marque a capa e o CTA se a IA não deduzir sozinha."
        />
        <ImageDropzone
          multiple
          accept="image/jpeg,image/png,image/webp"
          onFiles={(files) => void uploadFiles(files)}
          isUploading={pending > 0}
          icon={<ImagePlus className="size-6 text-muted-foreground/60" strokeWidth={1.25} />}
          title={pending > 0 ? `Enviando ${pending} arte(s)…` : "Adicionar artes ao estilo"}
          subtitle="JPEG, PNG ou WebP até 10MB. A ordem segue o nome do arquivo (card-1, card-2…)."
          minHeight="sm"
        />
        {images.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((image, index) => (
              <div key={image.id} className="group w-44 shrink-0 space-y-2">
                <div className="relative overflow-hidden rounded-xl ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.storage_url}
                    alt={image.file_name ?? `Card ${index + 1}`}
                    className="aspect-[4/5] w-full bg-surface object-cover"
                    loading="lazy"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-white">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeImage(image)}
                    title="Remover arte"
                    className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-lg border border-border bg-popover text-foreground opacity-0 shadow-[var(--surface-shadow)] transition-premium hover:bg-destructive hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Remover</span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label="Mover para a esquerda"
                  >
                    <ChevronLeft />
                  </Button>
                  <select
                    value={image.role ?? ""}
                    onChange={(e) => setRole(image, (e.target.value || null) as CarouselStyleImage["role"])}
                    className={selectClass}
                    aria-label="Papel da arte"
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.label} value={o.value ?? ""}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Mover para a direita"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Sparkles}
          tone="violet"
          title="DNA do estilo"
          description="O que a IA entendeu do conjunto. É isso que o diretor de arte segue ao gerar um carrossel com este estilo."
          action={
            <div className="flex items-center gap-2">
              <StyleStatusBadge status={style.analysis_status} hasImages={images.length > 0} />
              <Button size="sm" disabled={analyzing || pending > 0 || images.length === 0} onClick={() => void analyze()}>
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {style.dna ? "Analisar de novo" : "Analisar estilo"}
              </Button>
            </div>
          }
        />
        {changedSinceAnalysis && style.dna ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-tone-amber">
            <AlertTriangle className="size-3.5" />
            As artes mudaram desde a última análise. Analise de novo para o DNA refletir o conjunto.
          </p>
        ) : null}
        {style.analysis_status === "failed" && style.analysis_error ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-tone-red">
            <AlertTriangle className="size-4" />
            {style.analysis_error}
          </p>
        ) : null}
        {analyzing ? (
          <Surface padding="md" className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-tone-violet" />
            Lendo as {images.length} artes juntas… leva de 30 a 60 segundos.
          </Surface>
        ) : style.dna ? (
          <StyleDnaView dna={style.dna} />
        ) : (
          <Surface variant="dashed" padding="md" className="text-sm text-muted-foreground">
            {images.length === 0
              ? "Suba as artes do estilo e clique em Analisar."
              : "Clique em Analisar estilo para a IA ler as artes e extrair o DNA."}
          </Surface>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={LayoutTemplate}
          tone="cyan"
          title="Páginas-modelo"
          description="Cada arte vira uma página editável do Studio. Na geração, a IA escolhe um modelo por card e só troca os campos (título, corpo, imagem…); o resto do layout fica igual ao estilo."
          action={
            template?.document?.pages.length ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={startingTemplates || isStudioBusy(template.status)} onClick={() => void draftTemplates(true)}>
                  <RefreshCw />
                  Remontar
                </Button>
                <Link href={`/carousel/studio/${template.id}`} className={buttonVariants({ size: "sm" })}>
                  <PenTool />
                  Editar no Studio
                </Link>
              </div>
            ) : (
              <Button size="sm" disabled={startingTemplates || images.length === 0 || pending > 0} onClick={() => void draftTemplates(false)}>
                {startingTemplates ? <Loader2 className="animate-spin" /> : <LayoutTemplate />}
                Montar páginas-modelo
              </Button>
            )
          }
        />
        {template && isStudioBusy(template.status) ? (
          <Surface padding="md" className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-tone-cyan" />
            {template.generation.message ?? "Montando…"}{" "}
            <Link href={`/carousel/studio/${template.id}`} className="underline">
              Acompanhar no editor
            </Link>
          </Surface>
        ) : template?.document?.pages.length ? (
          <div className="space-y-2">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {template.document.pages.map((page) => {
                const slots = Array.from(new Set(page.layers.map((l) => l.slot).filter(Boolean)));
                return (
                  <Link key={page.id} href={`/carousel/studio/${template.id}`} className="w-44 shrink-0 space-y-1.5">
                    <FrameThumbnail
                      page={page}
                      width={template.document!.width}
                      height={template.document!.height}
                      displayWidth={176}
                      className="rounded-xl ring-1 ring-border transition hover:ring-2 hover:ring-tone-cyan"
                    />
                    <p className="truncate text-xs font-semibold">{STUDIO_TEMPLATE_ROLE_LABEL[page.templateRole ?? "inner"]}</p>
                    <p className="line-clamp-2 text-[0.6875rem] text-muted-foreground">
                      {slots.length ? slots.map((s) => STUDIO_SLOT_LABEL[s!]).join(" · ") : "Sem campos: marque no editor"}
                    </p>
                  </Link>
                );
              })}
            </div>
            {template.generation.error ? <p className="text-xs text-tone-amber">{template.generation.error}</p> : null}
            <p className="text-xs text-muted-foreground">
              Confira no editor: ajuste posições, fontes e marque em cada camada o campo que muda (painel à direita → Campo do modelo).
            </p>
          </div>
        ) : (
          <Surface variant="dashed" padding="md" className="text-sm text-muted-foreground">
            {template?.status === "failed" && template.generation.error
              ? `A montagem falhou: ${template.generation.error}`
              : "A IA desmonta cada arte em camadas (textos, formas, enfeites recortados da própria arte). Sem páginas-modelo, a geração só segue o DNA em texto e fica bem menos fiel."}
          </Surface>
        )}
      </section>

      <div className="border-t border-border pt-6">
        <Button variant="ghost" size="sm" className="text-tone-red" onClick={() => void removeStyle()}>
          <Trash2 />
          Excluir estilo
        </Button>
      </div>
    </div>
  );
}
