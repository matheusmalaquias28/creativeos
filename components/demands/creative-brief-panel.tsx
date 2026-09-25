"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import {
  generateCreativeBriefAction,
  type ArtBrief,
} from "@/actions/creative-brief";

type Props = {
  demandId: string;
  hasClient: boolean;
};

function BriefCard({ brief, index }: { brief: ArtBrief; index: number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(brief.prompt_magnific);
    setCopied(true);
    toast.success("Prompt copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="surface-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[0.6875rem] font-bold tabular-nums text-primary">
          {index + 1}
        </span>
        <p className="text-sm font-semibold leading-snug text-foreground">
          {brief.headline || `Arte ${index + 1}`}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Conceito", value: brief.conceito_visual },
            { label: "Composição", value: brief.composicao },
            { label: "Iluminação", value: brief.iluminacao },
            { label: "Mood", value: brief.mood },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-border/70 bg-surface p-3"
            >
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {label}
              </p>
              <p className="text-xs leading-relaxed text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Estilo */}
        <div className="rounded-xl border border-border/70 bg-surface px-3 py-2.5">
          <span className="text-xs font-semibold text-muted-foreground">
            Estilo fotográfico
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground">{brief.estilo}</p>
        </div>

        {/* Prompt Magnific */}
        <div className="rounded-xl border border-primary/25 bg-primary/8 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Prompt Magnific</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-primary hover:bg-primary/12 hover:text-primary"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="select-all text-xs leading-relaxed text-foreground">
            {brief.prompt_magnific}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CreativeBriefPanel({ demandId, hasClient }: Props) {
  const [briefs, setBriefs] = useState<ArtBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasResult = briefs.length > 0;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const result = await generateCreativeBriefAction(demandId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      toast.error(result.error);
    } else {
      setBriefs(result.briefs);
    }
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Wand2}
        tone="pink"
        title="Brief Visual IA"
        description={
          hasResult
            ? "Prompts prontos para o Magnific — clique para copiar"
            : "Gera conceito visual e prompt otimizado para cada arte"
        }
        action={
          <Button
            size="sm"
            variant={hasResult ? "outline" : "default"}
            className={cn("gap-1.5 shrink-0", !hasClient && "opacity-50")}
            onClick={handleGenerate}
            disabled={loading || !hasClient}
            title={!hasClient ? "Vincule um cliente à demanda primeiro" : undefined}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hasResult ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? "Gerando..." : hasResult ? "Regenerar" : "Gerar Brief"}
          </Button>
        }
      />

      {error && (
        <p className={cn("rounded-xl border px-3 py-2 text-sm", tones.red.badge)}>
          {error}
        </p>
      )}

      {!hasClient && !hasResult && (
        <p className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[0.8125rem] font-medium", tones.amber.badge)}>
          <AlertTriangle className="size-3.5 shrink-0" />
          Vincule um cliente à demanda para gerar o brief visual.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface/50 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" />
          Analisando copy e identidade visual do cliente...
        </div>
      )}

      {hasResult && !loading && (
        <div className="space-y-3">
          {briefs.map((brief, i) => (
            <BriefCard key={brief.arte_index} brief={brief} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
