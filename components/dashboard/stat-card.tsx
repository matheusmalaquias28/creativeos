import { type LucideIcon } from "lucide-react";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: React.ReactNode;
  icon: LucideIcon;
  className?: string;
  /** Tom do ícone e do detalhe de cor. */
  tone?: Tone;
  /** Legado: mapeado para um tom. */
  accent?: "positive" | "negative" | "warning" | "neutral";
  /** Conteúdo extra no rodapé (mini gráfico, barra de progresso…). */
  footer?: React.ReactNode;
};

const accentToTone: Record<NonNullable<StatCardProps["accent"]>, Tone> = {
  positive: "green",
  negative: "red",
  warning: "amber",
  neutral: "violet",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  tone,
  accent = "neutral",
  footer,
}: StatCardProps) {
  const t = tones[tone ?? accentToTone[accent]];

  return (
    <div
      className={cn(
        "surface-panel hover-lift group relative flex flex-col gap-4 overflow-hidden p-5",
        className
      )}
    >
      {/* Brilho sutil do tom no canto */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-[0.10] blur-2xl transition-opacity group-hover:opacity-[0.16]"
        style={{ background: t.cssVar }}
      />
      <div className="relative flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-xl", t.iconTile)}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <p className="text-[0.8125rem] font-semibold text-muted-foreground">{title}</p>
      </div>
      <div className="relative">
        <p className="text-[2rem] leading-none font-bold tracking-[-0.03em] tabular-nums text-foreground">
          {value}
        </p>
        {description && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {footer && <div className="relative">{footer}</div>}
    </div>
  );
}
