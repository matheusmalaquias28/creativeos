"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  removeIdentitySampleAction,
  retryIdentityExtractionAction,
  updateVisualIdentityDnaAction,
  uploadIdentitySampleAction,
} from "@/actions/visual-identity";
import { createClient } from "@/lib/supabase/client";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isValidHexColor, normalizeHexColor } from "@/lib/utils/color";
import {
  visualIdentityDnaSchema,
  type ClientVisualIdentityState,
  type IdentityExtractionStatus,
  type VisualIdentityDna,
} from "@/lib/schemas/visual-identity";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_SAMPLES = 5;

/** Editor de lista de chips (palavras-chave, elementos fixos, evitar). */
function TagListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.6875rem] text-foreground/90"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remover ${v}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
          className="h-7 text-xs"
        />
        <Button type="button" size="icon-xs" variant="outline" onClick={commit} className="shrink-0">
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}

/** Editor da paleta — chip de cor com input hex, mais um seletor pra facilitar. */
function PaletteEditor({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("#");

  function addColor() {
    const normalized = normalizeHexColor(draft);
    if (!normalized) {
      toast.error("Cor hex inválida");
      return;
    }
    onChange([...colors, normalized]);
    setDraft("#");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {colors.map((color, i) => (
          <span
            key={`${color}-${i}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.6875rem] font-mono"
          >
            <input
              type="color"
              value={isValidHexColor(color) ? color : "#000000"}
              onChange={(e) => {
                const next = [...colors];
                next[i] = e.target.value.toUpperCase();
                onChange(next);
              }}
              className="size-3 cursor-pointer border-0 bg-transparent p-0"
            />
            {color}
            <button
              type="button"
              onClick={() => onChange(colors.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remover ${color}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addColor();
            }
          }}
          placeholder="#RRGGBB"
          className="h-7 w-24 text-xs font-mono"
        />
        <Button type="button" size="icon-xs" variant="outline" onClick={addColor} className="shrink-0">
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function buildDnaText(dna: VisualIdentityDna): string {
  const lines: string[] = [
    `Resumo: ${dna.summary}`,
    `Paleta: ${dna.palette.join(", ")}`,
    `Tipografia — Headline: ${dna.typography.headlineStyle} · Corpo: ${dna.typography.bodyStyle}`,
    ...(dna.typography.notes ? [`Notas tipográficas: ${dna.typography.notes}`] : []),
    `Composição: ${dna.compositionStyle}`,
    `Mood: ${dna.mood}`,
    `Palavras-chave: ${dna.visualKeywords.join(", ")}`,
    `Elementos fixos: ${dna.elementsToRepeat.join(", ")}`,
    ...(dna.avoid?.length ? [`Evitar: ${dna.avoid.join(", ")}`] : []),
  ];
  return lines.join("\n");
}

type Props = {
  clientId: string;
  state: ClientVisualIdentityState;
  onStateChange?: (state: ClientVisualIdentityState) => void;
  compact?: boolean;
  showDnaDetails?: boolean;
};

export function VisualIdentityField({
  clientId,
  state,
  onStateChange,
  compact = false,
  showDnaDetails = true,
}: Props) {
  const [local, setLocal] = useState(state);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; });

  useEffect(() => setLocal(state), [state]);

  // Atualiza em tempo real quando a extração de DNA termina no servidor
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`visual-identity-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "client_creative_profile",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const parsed = visualIdentityDnaSchema.safeParse(row.visual_identity_dna);
          const next: Partial<ClientVisualIdentityState> = {
            identityExtractionStatus: (row.identity_extraction_status as IdentityExtractionStatus) ?? "idle",
            visualIdentityDna: parsed.success ? parsed.data : null,
            identityExtractionError: (row.identity_extraction_error as string | null) ?? null,
            identityExtractedAt: (row.identity_extracted_at as string | null) ?? null,
            basePrompt: (row.base_prompt as string) ?? "",
            palette: Array.isArray(row.palette) ? (row.palette as string[]) : [],
            ...(Array.isArray(row.identity_sample_urls)
              ? { identitySampleUrls: row.identity_sample_urls as string[] }
              : {}),
          };
          setLocal((prev) => {
            const merged = { ...prev, ...next };
            onStateChangeRef.current?.(merged);
            return merged;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  function patch(next: Partial<ClientVisualIdentityState>) {
    const merged = { ...local, ...next };
    setLocal(merged);
    onStateChange?.(merged);
  }

  function handleUpload(files: File[]) {
    const formData = new FormData();
    for (const file of files) formData.append("sample", file);

    startTransition(async () => {
      const result = await uploadIdentitySampleAction(clientId, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      patch({
        identitySampleUrls: result.sampleUrls ?? local.identitySampleUrls,
        identityExtractionStatus: "extracting",
        identityExtractionError: null,
        visualIdentityDna: null,
      });
      toast.success("Arte(s) enviada(s) — extraindo identidade visual...");
    });
  }

  function handleRemove(sampleUrl: string) {
    startTransition(async () => {
      const result = await removeIdentitySampleAction(clientId, sampleUrl);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const remaining = result.sampleUrls ?? [];
      patch(
        remaining.length === 0
          ? {
              identitySampleUrls: [],
              visualIdentityDna: null,
              identityExtractedAt: null,
              identityExtractionStatus: "idle",
              identityExtractionError: null,
              basePrompt: "",
              palette: [],
            }
          : {
              identitySampleUrls: remaining,
              identityExtractionStatus: "extracting",
              identityExtractionError: null,
              visualIdentityDna: null,
            }
      );
      toast.success("Amostra removida");
    });
  }

  function handleRetry() {
    startTransition(async () => {
      const result = await retryIdentityExtractionAction(clientId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      patch({ identityExtractionStatus: "extracting", identityExtractionError: null });
      toast.info("Reextraindo identidade visual...");
    });
  }

  async function handleCopyDna() {
    if (!local.visualIdentityDna) return;
    await navigator.clipboard.writeText(buildDnaText(local.visualIdentityDna));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("DNA copiado");
  }

  const [editingDna, setEditingDna] = useState(false);
  const [draftDna, setDraftDna] = useState<VisualIdentityDna | null>(null);
  const [isSavingDna, startSaveDna] = useTransition();

  function startEditingDna() {
    if (!local.visualIdentityDna) return;
    setDraftDna(local.visualIdentityDna);
    setEditingDna(true);
  }

  function cancelEditingDna() {
    setEditingDna(false);
    setDraftDna(null);
  }

  function handleSaveDna() {
    if (!draftDna) return;
    startSaveDna(async () => {
      const result = await updateVisualIdentityDnaAction(clientId, draftDna);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      patch({ visualIdentityDna: draftDna });
      setEditingDna(false);
      setDraftDna(null);
      toast.success("DNA atualizado");
    });
  }

  const extracting = local.identityExtractionStatus === "extracting" || isPending;
  const failed = local.identityExtractionStatus === "failed";
  const ready = local.identityExtractionStatus === "ready" && local.visualIdentityDna;

  return (
    <div className={cn("space-y-3", compact && "flex flex-1 flex-col")}>
      {!compact && (
        <div>
          <Label>Extrator de identidade visual</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Envie uma ou mais artes que representem a identidade visual do cliente.
          </p>
        </div>
      )}

      {local.identitySampleUrls.length > 0 ? (
        <div className="space-y-2">
          <div className={cn("grid gap-1.5", compact ? "grid-cols-3" : "grid-cols-4 sm:grid-cols-5")}>
            {local.identitySampleUrls.map((url) => (
              <div
                key={url}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Amostra de identidade visual"
                  className="size-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(url)}
                  aria-label="Remover amostra"
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md border border-tone-red/25 bg-popover/95 text-tone-red opacity-0 shadow-[var(--surface-shadow)] transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>

          {local.identitySampleUrls.length < MAX_SAMPLES && (
            <ImageDropzone
              variant="neon"
              accept={ACCEPT}
              multiple
              disabled={isPending}
              isUploading={isPending}
              onFiles={handleUpload}
              icon={<Plus className="size-5 text-muted-foreground/70" strokeWidth={1.25} />}
              title={`Adicionar mais artes (${local.identitySampleUrls.length}/${MAX_SAMPLES})`}
              subtitle="PNG, JPG ou WebP"
              minHeight="sm"
              className="flex-1"
            />
          )}

          <div className="flex flex-wrap gap-1.5">
            {extracting && (
              <span className="inline-flex items-center gap-1 rounded-full border border-tone-blue/25 bg-tone-blue/12 px-2 py-0.5 text-[0.6875rem] font-semibold text-tone-blue">
                <Loader2 className="size-3 animate-spin" />
                Extraindo...
              </span>
            )}
            {ready && (
              <span className="inline-flex items-center gap-1 rounded-full border border-tone-green/25 bg-tone-green/12 px-2 py-0.5 text-[0.6875rem] font-semibold text-tone-green">
                <Sparkles className="size-3" />
                DNA pronto
              </span>
            )}
            {failed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-tone-red/25 bg-tone-red/12 px-2 py-0.5 text-[0.6875rem] font-semibold text-tone-red">
                Falhou
              </span>
            )}
            {failed && (
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleRetry} className="h-7 text-xs">
                <RefreshCw className="size-3" />
                Tentar novamente
              </Button>
            )}
          </div>

          {failed && local.identityExtractionError && (
            <p className="text-[0.6875rem] text-tone-red">{local.identityExtractionError}</p>
          )}

          {showDnaDetails && ready && local.visualIdentityDna && !editingDna && (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  DNA visual
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[0.6875rem]"
                    onClick={startEditingDna}
                  >
                    <Pencil className="size-3" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[0.6875rem]"
                    onClick={handleCopyDna}
                  >
                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-foreground/90">
                {local.visualIdentityDna.summary}
              </p>

              <div className="flex flex-wrap gap-1">
                {local.visualIdentityDna.palette.map((color) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.6875rem] font-mono"
                  >
                    <span
                      className="size-2.5 rounded-full border border-border-strong"
                      style={{ backgroundColor: color }}
                    />
                    {color}
                  </span>
                ))}
              </div>

              <div className="grid gap-1.5 text-[0.6875rem] text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  <Type className="mt-0.5 size-3 shrink-0" />
                  <span>
                    {local.visualIdentityDna.typography.headlineStyle}
                    {" · "}
                    {local.visualIdentityDna.typography.bodyStyle}
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <Palette className="mt-0.5 size-3 shrink-0" />
                  <span>{local.visualIdentityDna.compositionStyle}</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <Wand2 className="mt-0.5 size-3 shrink-0" />
                  <span>{local.visualIdentityDna.mood}</span>
                </p>
              </div>

              {local.visualIdentityDna.visualKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {local.visualIdentityDna.visualKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {showDnaDetails && editingDna && draftDna && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Editar DNA visual
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSavingDna}
                    onClick={handleSaveDna}
                    className="h-6 gap-1 px-2 text-[0.6875rem]"
                  >
                    {isSavingDna ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isSavingDna}
                    onClick={cancelEditingDna}
                    className="h-6 gap-1 px-2 text-[0.6875rem]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Resumo</Label>
                <Input
                  value={draftDna.summary}
                  onChange={(e) => setDraftDna({ ...draftDna, summary: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Paleta</Label>
                <PaletteEditor
                  colors={draftDna.palette}
                  onChange={(palette) => setDraftDna({ ...draftDna, palette })}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tipografia — headline</Label>
                  <Input
                    value={draftDna.typography.headlineStyle}
                    onChange={(e) =>
                      setDraftDna({
                        ...draftDna,
                        typography: { ...draftDna.typography, headlineStyle: e.target.value },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipografia — corpo</Label>
                  <Input
                    value={draftDna.typography.bodyStyle}
                    onChange={(e) =>
                      setDraftDna({
                        ...draftDna,
                        typography: { ...draftDna.typography, bodyStyle: e.target.value },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Composição</Label>
                  <Input
                    value={draftDna.compositionStyle}
                    onChange={(e) => setDraftDna({ ...draftDna, compositionStyle: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mood</Label>
                  <Input
                    value={draftDna.mood}
                    onChange={(e) => setDraftDna({ ...draftDna, mood: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Palavras-chave</Label>
                <TagListEditor
                  values={draftDna.visualKeywords}
                  onChange={(visualKeywords) => setDraftDna({ ...draftDna, visualKeywords })}
                  placeholder="Nova palavra-chave"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Elementos fixos</Label>
                <TagListEditor
                  values={draftDna.elementsToRepeat}
                  onChange={(elementsToRepeat) => setDraftDna({ ...draftDna, elementsToRepeat })}
                  placeholder="Novo elemento"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Evitar</Label>
                <TagListEditor
                  values={draftDna.avoid ?? []}
                  onChange={(avoid) => setDraftDna({ ...draftDna, avoid })}
                  placeholder="Novo item a evitar"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <ImageDropzone
          variant="neon"
          accept={ACCEPT}
          multiple
          disabled={isPending}
          isUploading={isPending}
          onFiles={handleUpload}
          icon={<Sparkles className="size-6 text-muted-foreground/70" strokeWidth={1.25} />}
          title="Clique ou arraste uma ou mais artes"
          subtitle="PNG, JPG ou WebP"
          minHeight={compact ? "md" : "sm"}
          className="flex-1"
        />
      )}
    </div>
  );
}

/** Preview expandido do DNA — exportado para uso externo. */
export function VisualIdentityDnaPreview({ state }: { state: ClientVisualIdentityState }) {
  const dna = state.visualIdentityDna;
  if (state.identityExtractionStatus !== "ready" || !dna) return null;

  return (
    <div className="surface-panel space-y-3 p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-tone-pink/14 text-tone-pink ring-1 ring-inset ring-tone-pink/20">
          <Sparkles className="size-4" />
        </span>
        <h3 className="text-sm font-bold tracking-tight text-foreground">DNA visual extraído</h3>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{dna.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {dna.palette.map((color) => (
          <span
            key={color}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs font-mono text-foreground/90"
          >
            <span
              className="size-3 rounded-full border border-border-strong"
              style={{ backgroundColor: color }}
            />
            {color}
          </span>
        ))}
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <p>
          <strong className="text-foreground/80">Tipografia:</strong>{" "}
          {dna.typography.headlineStyle} · {dna.typography.bodyStyle}
        </p>
        <p>
          <strong className="text-foreground/80">Composição:</strong> {dna.compositionStyle}
        </p>
        <p>
          <strong className="text-foreground/80">Mood:</strong> {dna.mood}
        </p>
      </div>
    </div>
  );
}
