import type { LucideIcon } from "lucide-react";
import { tones, type Tone } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  className?: string;
  compact?: boolean;
};

/** Estado vazio padrão — ícone em tile colorido, título, texto e ação. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "violet",
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface/50 text-center",
        compact ? "px-6 py-8" : "px-6 py-14",
        className
      )}
    >
      <span
        className={cn(
          "mb-4 flex items-center justify-center rounded-2xl",
          compact ? "size-10" : "size-12",
          tones[tone].iconTile
        )}
      >
        <Icon className={compact ? "size-[1.125rem]" : "size-5"} strokeWidth={1.75} />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <div className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
