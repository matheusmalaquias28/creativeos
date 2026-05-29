"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { BrandDna } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CoreBrandDnaKey =
  | "brandStyle"
  | "visualDirection"
  | "audienceProfile"
  | "preferredColors"
  | "compositionPreferences"
  | "negativeStyles"
  | "recommendedHooks"
  | "visualKeywords";

type SectionDef = {
  key?: CoreBrandDnaKey;
  title: string;
  type: "text" | "list";
  getValue?: (dna: BrandDna) => string | string[] | undefined;
  fullWidth?: boolean;
};

const coreSections: SectionDef[] = [
  { key: "brandStyle", title: "Estilo da marca", type: "text" },
  { key: "visualDirection", title: "Direção visual", type: "text" },
  { key: "audienceProfile", title: "Perfil de audiência", type: "text" },
  { key: "preferredColors", title: "Cores preferidas", type: "list" },
  { key: "compositionPreferences", title: "Composição", type: "list" },
  { key: "negativeStyles", title: "Estilos a evitar", type: "list" },
  { key: "recommendedHooks", title: "Ganchos recomendados", type: "list" },
  { key: "visualKeywords", title: "Palavras-chave visuais", type: "list" },
];

const productionSections: SectionDef[] = [
  {
    title: "Layout e espaçamento",
    type: "list",
    getValue: (d) => d.productionRules?.layoutAndSpacing,
    fullWidth: true,
  },
  {
    title: "Tipografia",
    type: "list",
    getValue: (d) => d.productionRules?.typography,
  },
  {
    title: "Hierarquia visual",
    type: "list",
    getValue: (d) => d.productionRules?.visualHierarchy,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado");
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

function SectionCard({
  title,
  type,
  value,
  fullWidth,
}: {
  title: string;
  type: "text" | "list";
  value: string | string[] | undefined;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-panel space-y-3 p-5",
        fullWidth && "md:col-span-2"
      )}
    >
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {type === "text" ? (
        <p className="text-sm leading-relaxed text-foreground">
          {typeof value === "string" && value ? value : "—"}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {Array.isArray(value) && value.length > 0 ? (
            value.map((item) => (
              <li
                key={item}
                className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-foreground/90"
              >
                {item}
              </li>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </ul>
      )}
    </div>
  );
}

export function BrainViewer({ brandDna }: { brandDna: BrandDna }) {
  const hasProduction = Boolean(brandDna.productionRules);
  const hasReferenceInsights =
    Array.isArray(brandDna.referenceInsights) &&
    brandDna.referenceInsights.length > 0;

  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2">
        {coreSections.map((section) => (
          <SectionCard
            key={section.key}
            title={section.title}
            type={section.type}
            value={section.key ? brandDna[section.key] : undefined}
          />
        ))}
      </div>

      {hasReferenceInsights && brandDna.referenceInsights && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium tracking-heading">
              Análise das referências
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sinais extraídos das imagens enviadas (usados no Brand DNA)
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {brandDna.referenceInsights.map((insight) => (
              <div key={insight.source} className="surface-panel space-y-3 p-5">
                <div>
                  <p className="text-sm font-medium">{insight.source}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {insight.visualRole}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {insight.signals.map((signal) => (
                    <li
                      key={signal}
                      className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-foreground/90"
                    >
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasProduction && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium tracking-heading">
              Regras de produção gráfica
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Espaçamento, respiros, tipografia e hierarquia — referência para toda arte
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {productionSections.map((section) => (
              <SectionCard
                key={section.title}
                title={section.title}
                type={section.type}
                value={section.getValue?.(brandDna)}
                fullWidth={section.fullWidth}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
