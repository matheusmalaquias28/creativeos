"use client";

import { useState } from "react";
import { Copy, Check, Ruler, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import type { BrandDna } from "@/types";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/layout/section-header";
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
      <h3 className="text-[0.8125rem] font-semibold text-muted-foreground">
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
                className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground/90"
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
          <SectionHeader
            title="Análise das referências"
            description="Sinais extraídos das imagens enviadas (usados no Brand DNA)"
            icon={ScanSearch}
            tone="cyan"
          />
          <div className="grid gap-4 md:grid-cols-2">
            {brandDna.referenceInsights.map((insight) => (
              <div key={insight.source} className="surface-panel space-y-3 p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{insight.source}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {insight.visualRole}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {insight.signals.map((signal) => (
                    <li
                      key={signal}
                      className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground/90"
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
          <SectionHeader
            title="Regras de produção gráfica"
            description="Espaçamento, respiros, tipografia e hierarquia — referência para toda arte"
            icon={Ruler}
            tone="orange"
          />
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
