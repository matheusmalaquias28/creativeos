import type { LucideIcon } from "lucide-react";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  action?: React.ReactNode;
  className?: string;
};

/** Cabeçalho de seção dentro de uma página (título + descrição + ação). */
export function SectionHeader({
  title,
  description,
  icon: Icon,
  tone = "violet",
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              tones[tone].iconTile
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
