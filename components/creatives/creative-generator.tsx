"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2, Maximize2, Sparkles, Trash2, X } from "lucide-react";
import {
  deleteCreativeAction,
  generateCreativeAction,
} from "@/actions/creatives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JsonCodeViewer } from "@/components/ui/json-code-viewer";
import { cn } from "@/lib/utils";
import type { BrandDna, GeneratedCreative, NanoBananaPromptTemplate } from "@/types";

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1",  label: "1:1",  sub: "Quadrado" },
  { value: "4:5",  label: "4:5",  sub: "Portrait" },
  { value: "9:16", label: "9:16", sub: "Stories" },
  { value: "16:9", label: "16:9", sub: "Wide" },
  { value: "4:3",  label: "4:3",  sub: "Paisagem" },
  { value: "3:4",  label: "3:4",  sub: "Retrato" },
];

const QUALITY_OPTIONS = [
  { value: "1k", label: "1K", sub: "Padrão" },
  { value: "2k", label: "2K", sub: "HD" },
  { value: "4k", label: "4K", sub: "Ultra" },
];

const QUANTITY_OPTIONS = [1, 2, 3, 4];

type CreativeGeneratorProps = {
  clientId: string;
  brainId: string;
  brandDna: BrandDna;
  templates: NanoBananaPromptTemplate[];
  initialCreatives: GeneratedCreative[];
};

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export function CreativeGenerator({
  clientId,
  brainId,
  brandDna,
  templates,
  initialCreatives,
}: CreativeGeneratorProps) {
  const [creatives, setCreatives] = useState(initialCreatives);
  const [templateName, setTemplateName] = useState(templates[0]?.name ?? "");
  const [aspectRatio, setAspectRatio] = useState(templates[0]?.aspectRatio ?? "1:1");
  const [quality, setQuality] = useState("1k");
  const [quantity, setQuantity] = useState(1);
  const [headline, setHeadline] = useState("");
  const [cta, setCta] = useState("");
  const [extraDetails, setExtraDetails] = useState("");
  const [useReferences, setUseReferences] = useState(true);
  const [useLogo, setUseLogo] = useState(true);
  const [isGenerating, startGenerating] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [previewPayload, setPreviewPayload] = useState<Record<string, unknown> | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<{ count: number; templateName: string } | null>(null);

  const selectedTemplate = templates.find((t) => t.name === templateName);

  const handlePreviewPrompt = () => {
    if (!selectedTemplate) return;
    import("@/lib/ai/build-nano-banana-prompt").then(({ buildNanoBananaPromptFromTemplate }) => {
      const json = JSON.parse(
        buildNanoBananaPromptFromTemplate(selectedTemplate, brandDna, {
          headline: headline || undefined,
          cta: cta || undefined,
          extraDetails: extraDetails || undefined,
        })
      ) as Record<string, unknown>;
      setPreviewPayload(json);
    });
  };

  const handleGenerate = () => {
    if (!templateName) {
      toast.error("Selecione um template");
      return;
    }
    setPendingGeneration({ count: quantity, templateName });
    startGenerating(async () => {
      const params = {
        clientId,
        brainId,
        templateName,
        aspectRatio,
        quality,
        headline: headline || undefined,
        cta: cta || undefined,
        extraDetails: extraDetails || undefined,
        useReferences,
        useLogo,
      };

      const results = await Promise.all(
        Array.from({ length: quantity }, () => generateCreativeAction(params))
      );

      setPendingGeneration(null);

      const newCreatives: GeneratedCreative[] = [];
      let errorCount = 0;

      for (const result of results) {
        if (result.error) {
          errorCount++;
          toast.error(result.error);
        } else if (result.publicUrl && result.creativeId) {
          newCreatives.push({
            id: result.creativeId,
            client_id: clientId,
            creative_brain_id: brainId,
            template_name: templateName,
            prompt_payload: {},
            storage_path: "",
            public_url: result.publicUrl,
            mime_type: "image/png",
            aspect_ratio: aspectRatio,
            model: "nano-banana",
            status: "completed",
            error_message: null,
            created_by: null,
            created_at: new Date().toISOString(),
          });
        }
      }

      if (newCreatives.length > 0) {
        toast.success(
          newCreatives.length === 1
            ? "Criativo gerado com sucesso"
            : `${newCreatives.length} criativos gerados com sucesso`
        );
        setCreatives((prev) => [...newCreatives, ...prev]);
      }

      if (errorCount > 0 && newCreatives.length === 0) return;
    });
  };

  const handleDelete = (creativeId: string) => {
    startDeleting(async () => {
      const result = await deleteCreativeAction(clientId, creativeId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Criativo removido");
        setCreatives((prev) => prev.filter((c) => c.id !== creativeId));
      }
    });
  };

  const completedCount = creatives.filter((c) => c.status === "completed").length;

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Criativo em tela cheia"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="space-y-10">
        <div className="surface-panel space-y-6 p-6">
          <div>
            <h2 className="text-lg font-medium tracking-heading">
              Gerar criativo
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nano Banana — geração via Gemini Image com Brand DNA do cliente.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template">Template do Brand DNA</Label>
              <select
                id="template"
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  const t = templates.find((t) => t.name === e.target.value);
                  if (t?.aspectRatio) setAspectRatio(t.aspectRatio);
                }}
                className="h-10 w-full rounded-lg border border-border/50 bg-input/30 px-3 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.aspectRatio})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline">Headline (opcional)</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Texto que pode aparecer na arte"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta">CTA (opcional)</Label>
              <Input
                id="cta"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Ex: Saiba mais"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="extra">Detalhes extras na cena (opcional)</Label>
              <Textarea
                id="extra"
                value={extraDetails}
                onChange={(e) => setExtraDetails(e.target.value)}
                placeholder="Ajustes pictóricos — não use hex ou regras de layout aqui"
                rows={2}
              />
            </div>
          </div>

          {/* Formato · Quantidade · Qualidade */}
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="flex flex-wrap gap-1.5">
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAspectRatio(opt.value)}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      aspectRatio === opt.value
                        ? "border-foreground/40 bg-foreground/10 font-medium text-foreground"
                        : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                    )}
                  >
                    <span className="font-mono font-semibold">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quantidade</Label>
              <div className="flex gap-1.5">
                {QUANTITY_OPTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                      quantity === q
                        ? "border-foreground/40 bg-foreground/10 text-foreground"
                        : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                    )}
                  >
                    {q}×
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Qualidade</Label>
              <div className="flex gap-1.5">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuality(opt.value)}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-3 py-1.5 text-xs transition-colors",
                      quality === opt.value
                        ? "border-foreground/40 bg-foreground/10 font-medium text-foreground"
                        : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                    )}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useReferences}
                onChange={(e) => setUseReferences(e.target.checked)}
                className="rounded border-border"
              />
              Incluir referências do cliente
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useLogo}
                onChange={(e) => setUseLogo(e.target.checked)}
                className="rounded border-border"
              />
              Incluir logo no contexto visual
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewPrompt}
              disabled={!selectedTemplate}
            >
              Pré-visualizar payload
            </Button>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !templateName}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Gerando imagem...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Gerar com Nano Banana
                </>
              )}
            </Button>
          </div>

          {previewPayload && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Payload enviado à API (applySilently = regras invisíveis na arte)
              </p>
              <JsonCodeViewer value={previewPayload} maxHeight="max-h-64" />
            </div>
          )}
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-heading">
            Criativos gerados ({completedCount})
          </h2>

          {creatives.length === 0 && !isGenerating ? (
            <div className="surface-panel p-8 text-center text-sm text-muted-foreground">
              Nenhum criativo gerado ainda.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Pending cards */}
              {isGenerating && pendingGeneration &&
                Array.from({ length: pendingGeneration.count }).map((_, i) => (
                  <div key={`pending-${i}`} className="surface-panel overflow-hidden">
                    <div className="flex aspect-square items-center justify-center bg-muted/10">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="size-8 animate-spin text-muted-foreground/60" />
                        <p className="text-xs text-muted-foreground">
                          Gerando com Nano Banana…
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="truncate text-sm font-medium">{pendingGeneration.templateName}</p>
                      <p className="text-xs text-muted-foreground">
                        {aspectRatio} · {quality.toUpperCase()} · Processando…
                      </p>
                    </div>
                  </div>
                ))
              }

              {creatives.map((creative) => (
                <div key={creative.id} className="surface-panel overflow-hidden">
                  {creative.status === "completed" && creative.public_url ? (
                    <div className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={creative.public_url}
                        alt={creative.template_name ?? "Criativo"}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <button
                          type="button"
                          title="Ver em tela cheia"
                          onClick={() => setLightboxUrl(creative.public_url)}
                          className="flex size-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                        >
                          <Maximize2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Baixar imagem"
                          onClick={() =>
                            downloadImage(
                              creative.public_url,
                              `${creative.template_name ?? "criativo"}-${creative.id.slice(0, 8)}.png`
                            )
                          }
                          className="flex size-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                        >
                          <Download className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-destructive/10 p-4 text-center text-xs text-destructive">
                      {creative.error_message ?? "Falha na geração"}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {creative.template_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {creative.aspect_ratio} · {creative.model}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(creative.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
