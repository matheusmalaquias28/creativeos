import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  className?: string;
  accent?: "positive" | "negative" | "warning" | "neutral";
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  accent = "neutral",
}: StatCardProps) {
  const accentMap = {
    positive: "dark:border-positive/20",
    negative: "dark:border-negative/20",
    warning: "dark:border-warning/20",
    neutral: "",
  };

  const iconAccentMap = {
    positive: "text-positive",
    negative: "text-negative",
    warning: "text-warning",
    neutral: "text-muted-foreground/60",
  };

  return (
    <div
      className={cn(
        "surface-panel hover-lift flex flex-col gap-5 p-6",
        accentMap[accent],
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-[0.625rem] font-semibold tracking-[0.1em] text-muted-foreground/70 uppercase">
          {title}
        </p>
        <div className={cn(
          "flex size-7 items-center justify-center rounded-lg border border-border/60 dark:border-white/8",
          accent !== "neutral" ? "dark:bg-white/4" : "dark:bg-white/3"
        )}>
          <Icon
            className={cn("size-3.5 shrink-0", iconAccentMap[accent])}
            strokeWidth={1.75}
          />
        </div>
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {description && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
