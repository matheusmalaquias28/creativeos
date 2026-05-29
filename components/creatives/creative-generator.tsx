"use client";

import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildSpacesPrompt } from "@/lib/ai/build-spaces-prompt";
import type { BrandDna } from "@/types";

type CreativeGeneratorProps = {
  brandDna: BrandDna;
};

export function CreativeGenerator({ brandDna }: CreativeGeneratorProps) {
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [cta, setCta] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const result = buildSpacesPrompt(brandDna, {
      headline: headline.trim() || undefined,
      subheadline: subheadline.trim() || undefined,
      cta: cta.trim() || undefined,
      extraContext: extraContext.trim() || undefined,
    });
    setPrompt(result);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="surface-panel space-y-6 p-6">
        <div>
          <h2 className="text-lg font-medium tracking-heading">
            Gerador de prompt
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha a copy da campanha e copie o prompt pronto para o Magnific Spaces.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Ex: Seu imóvel dos sonhos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subheadline">Subheadline</Label>
            <Input
              id="subheadline"
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              placeholder="Ex: Financiamento facilitado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cta">CTA</Label>
            <Input
              id="cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Ex: Saiba mais"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extra">Contexto extra (opcional)</Label>
            <Input
              id="extra"
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Ex: Arte para Stories, fundo escuro"
            />
          </div>
        </div>

        <Button type="button" onClick={handleGenerate} className="gap-2">
          <Sparkles className="size-4" />
          Gerar prompt
        </Button>
      </div>

      {prompt && (
        <div className="surface-panel space-y-3 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Prompt gerado</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <Textarea
            value={prompt}
            readOnly
            rows={6}
            className="resize-none font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Cole no Magnific Spaces e adicione suas referências manualmente.
          </p>
        </div>
      )}
    </div>
  );
}
