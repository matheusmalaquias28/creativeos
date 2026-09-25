"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ModernColorPicker, FontPicker } from "@/components/carousel/controls/pickers";
import { CTA_ICONS, getCtaIcon } from "@/lib/carousel/cta-icons";
import { X } from "lucide-react";
import type { CarouselCta, CtaShape } from "@/types/carousel";

const SHAPES: { id: CtaShape; label: string; radius: string }[] = [
  { id: "pill", label: "Pílula", radius: "rounded-full" },
  { id: "rounded", label: "Arredondado", radius: "rounded-lg" },
  { id: "square", label: "Quadrado", radius: "rounded-none" },
];

export function CtaControls({
  cta,
  onChange,
}: {
  cta: CarouselCta;
  onChange: (patch: Partial<CarouselCta>) => void;
}) {
  const PreviewIcon = getCtaIcon(cta.icon);

  return (
    <div className="space-y-4">
      {/* Enable */}
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-[0.8125rem] font-semibold text-foreground">Exibir CTA neste slide</span>
        <input
          type="checkbox"
          checked={cta.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="size-4 accent-primary cursor-pointer"
        />
      </label>

      {cta.enabled && (
        <>
          {/* Live preview (CTA is always centered at the bottom of the slide) — estilos inline = conteúdo do slide */}
          <div className="bg-dot-grid flex justify-center rounded-xl border border-border bg-surface px-4 py-4">
            <div
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 text-sm font-bold",
                cta.shape === "pill" ? "rounded-full" : cta.shape === "rounded" ? "rounded-lg" : "rounded-none"
              )}
              style={{
                backgroundColor: cta.bgColor,
                color: cta.textColor,
                border: cta.borderColor ? `2px solid ${cta.borderColor}` : undefined,
                fontFamily: cta.fontFamily,
              }}
            >
              {cta.text || "Texto do botão"}
              {PreviewIcon && <PreviewIcon className="size-4" strokeWidth={2.5} />}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Texto do botão</label>
            <Input
              value={cta.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="Ex: Saiba mais"
              className="h-8 text-xs"
            />
          </div>

          {/* Shape */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Formato</label>
            <div className="flex gap-1">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onChange({ shape: s.id })}
                  className={cn(
                    "flex-1 border px-2 py-1.5 text-[0.6875rem] font-semibold transition-colors",
                    s.radius,
                    cta.shape === s.id
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-accent hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
            O CTA aparece sempre centralizado na parte inferior do slide.
          </p>

          {/* Font */}
          <FontPicker label="Fonte do botão" value={cta.fontFamily} onChange={(f) => onChange({ fontFamily: f })} />

          {/* Colors */}
          <ModernColorPicker label="Cor de fundo" value={cta.bgColor} onChange={(v) => onChange({ bgColor: v })} />
          <ModernColorPicker label="Cor do texto" value={cta.textColor} onChange={(v) => onChange({ textColor: v })} />
          <ModernColorPicker label="Cor da borda" value={cta.borderColor} onChange={(v) => onChange({ borderColor: v })} allowNone />

          {/* Icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ícone</label>
            <div className="grid grid-cols-7 gap-1">
              <button
                onClick={() => onChange({ icon: "" })}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                  !cta.icon ? "border-primary/50 bg-primary/12 text-primary" : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-accent hover:text-foreground"
                )}
                title="Sem ícone"
              >
                <X className="size-3.5" />
              </button>
              {CTA_ICONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => onChange({ icon: id })}
                  title={label}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                    cta.icon === id ? "border-primary/50 bg-primary/12 text-primary" : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
