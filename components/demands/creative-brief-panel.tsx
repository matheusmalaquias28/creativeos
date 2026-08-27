"use client";

import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden dark:border-white/8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3 dark:border-white/6">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[0.625rem] font-bold text-primary">
          {index + 1}
        </span>
        <p className="text-sm font-medium text-foreground leading-snug">
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
              className="rounded-lg border border-border/40 bg-muted/30 p-2.5 dark:border-white/6 dark:bg-white/[0.03]"
            >
              <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {label}
              </p>
              <p className="text-xs leading-relaxed text-foreground/85">{value}</p>
            </div>
          ))}
        </div>

        {/* Estilo */}
        <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 dark:border-white/6">
          <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Estilo fotográfico
          </span>
          <p className="mt-0.5 text-xs text-foreground/80">{brief.estilo}</p>
        </div>

        {/* Prompt Magnific */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 dark:border-primary/15 dark:bg-primary/[0.06]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Prompt Magnific</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[0.625rem] text-primary hover:bg-primary/10"
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
          <p className="select-all text-xs leading-relaxed text-foreground/90">
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium tracking-heading">Brief Visual IA</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasResult
              ? "Prompts prontos para o Magnific — clique para copiar"
              : "Gera conceito visual e prompt otimizado para cada arte"}
          </p>
        </div>

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
      </div>

      {error && (
        <p className="rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}

      {!hasClient && !hasResult && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Vincule um cliente à demanda para gerar o brief visual.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
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
