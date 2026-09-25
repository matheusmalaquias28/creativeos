"use client";

import { useState } from "react";
import { Copy, Check, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildSpacesPrompt } from "@/lib/ai/build-spaces-prompt";
import type { BrandDna } from "@/types";

type CreativeGeneratorProps = {
  brandDna: BrandDna;
  clientName?: string;
};

export function CreativeGenerator({ brandDna, clientName }: CreativeGeneratorProps) {
  const logoReference = clientName
    ? `@logo(${clientName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "") || "cliente"})`
    : undefined;
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
      logoReference,
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
    <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
      <div className="surface-panel space-y-6 p-6">
        <SectionHeader
          title="Copy da campanha"
          description="Preencha os textos e gere o prompt pronto para o Magnific Spaces."
          icon={PenLine}
          tone="violet"
        />

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

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="button" onClick={handleGenerate}>
            <Sparkles className="size-4" />
            Gerar prompt
          </Button>
        </div>
      </div>

      <div className="surface-panel space-y-4 p-6">
        <SectionHeader
          title="Prompt gerado"
          description="Copie e cole no Magnific Spaces."
          icon={Sparkles}
          tone="pink"
          action={
            prompt ? (
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            ) : undefined
          }
        />
        {prompt ? (
          <>
            <Textarea
              value={prompt}
              readOnly
              rows={8}
              className="resize-none bg-surface font-mono text-sm"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cole no Magnific Spaces.{logoReference ? ` O prompt já inclui ${logoReference} — certifique-se de ter enviado a logo no Spaces.` : " Adicione suas referências manualmente."}
            </p>
          </>
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-10 text-center text-sm text-muted-foreground">
            Preencha a copy e clique em “Gerar prompt” para ver o resultado aqui.
          </div>
        )}
      </div>
    </div>
  );
}
