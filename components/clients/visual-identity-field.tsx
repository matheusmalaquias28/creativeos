"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Loader2, Palette, RefreshCw, Sparkles, Trash2, Type, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  removeIdentitySampleAction,
  retryIdentityExtractionAction,
  uploadIdentitySampleAction,
} from "@/actions/visual-identity";
import { createClient } from "@/lib/supabase/client";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  visualIdentityDnaSchema,
  type ClientVisualIdentityState,
  type IdentityExtractionStatus,
  type VisualIdentityDna,
} from "@/lib/schemas/visual-identity";

const ACCEPT = "image/jpeg,image/png,image/webp";

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

  function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("sample", file);

    startTransition(async () => {
      const result = await uploadIdentitySampleAction(clientId, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      patch({
        identitySampleUrl: result.sampleUrl ?? local.identitySampleUrl,
        identityExtractionStatus: "extracting",
        identityExtractionError: null,
        visualIdentityDna: null,
      });
      toast.success("Arte enviada — extraindo identidade visual...");
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeIdentitySampleAction(clientId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      patch({
        identitySampleUrl: null,
        visualIdentityDna: null,
        identityExtractedAt: null,
        identityExtractionStatus: "idle",
        identityExtractionError: null,
        basePrompt: "",
        palette: [],
      });
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

  const extracting = local.identityExtractionStatus === "extracting" || isPending;
  const failed = local.identityExtractionStatus === "failed";
  const ready = local.identityExtractionStatus === "ready" && local.visualIdentityDna;

  return (
    <div className={cn("space-y-3", compact && "flex flex-1 flex-col")}>
      {!compact && (
        <div>
          <Label>Extrator de identidade visual</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Envie uma arte que represente a identidade visual do cliente.
          </p>
        </div>
      )}

      {local.identitySampleUrl ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={local.identitySampleUrl}
              alt="Amostra de identidade visual"
              className={cn(
                "w-full object-contain bg-black/20",
                compact ? "max-h-36" : "max-h-64"
              )}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {extracting && (
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[0.625rem] text-foreground/80">
                <Loader2 className="size-3 animate-spin" />
                Extraindo...
              </span>
            )}
            {ready && (
              <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[0.625rem] text-foreground/80">
                <Sparkles className="size-3" />
                DNA pronto
              </span>
            )}
            {failed && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[0.625rem] text-red-300">
                Falhou
              </span>
            )}
            {failed && (
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleRetry} className="h-7 text-xs">
                <RefreshCw className="size-3" />
                Retry
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={handleRemove} className="h-7 text-xs">
              <Trash2 className="size-3" />
            </Button>
          </div>

          {failed && local.identityExtractionError && (
            <p className="text-[0.625rem] text-red-400/90">{local.identityExtractionError}</p>
          )}

          {showDnaDetails && ready && local.visualIdentityDna && (
            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                  DNA visual
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[0.625rem]"
                  onClick={handleCopyDna}
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-foreground/90">
                {local.visualIdentityDna.summary}
              </p>

              <div className="flex flex-wrap gap-1">
                {local.visualIdentityDna.palette.map((color) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 text-[0.625rem] font-mono"
                  >
                    <span
                      className="size-2.5 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                    {color}
                  </span>
                ))}
              </div>

              <div className="grid gap-1.5 text-[0.625rem] text-muted-foreground">
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
                      className="rounded-md border border-white/8 bg-black/15 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <ImageDropzone
          variant="neon"
          accept={ACCEPT}
          multiple={false}
          disabled={isPending}
          isUploading={isPending}
          onFiles={(files) => handleUpload(files[0])}
          icon={<Sparkles className="size-6 text-white/45" strokeWidth={1.25} />}
          title="Clique ou arraste a arte"
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
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-foreground/70" />
        <h3 className="text-sm font-medium text-foreground">DNA visual extraído</h3>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{dna.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {dna.palette.map((color) => (
          <span
            key={color}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-mono text-foreground/80"
          >
            <span
              className="size-3 rounded-full border border-white/20"
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
