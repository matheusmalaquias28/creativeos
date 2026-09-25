import Link from "next/link";
import { cn } from "@/lib/utils";

export type SegmentedOption<V extends string = string> = {
  value: V;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Contador opcional exibido à direita do rótulo. */
  count?: number;
  /** Quando definido, o segmento vira um <Link>. */
  href?: string;
};

type SegmentedControlProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange?: (value: V) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
};

/**
 * Alternador em pílula (Ativas / Arquivadas, 24h / 7d…). Aceita navegação por
 * link (server components) ou estado local via onChange.
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...rest
}: SegmentedControlProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-0.5 rounded-xl border border-border bg-surface p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const itemClass = cn(
          "inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[0.8125rem]",
          active
            ? "bg-card text-foreground shadow-[var(--surface-shadow),var(--inner-highlight)] ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground"
        );
        const content = (
          <>
            {option.icon}
            {option.label}
            {typeof option.count === "number" && (
              <span
                className={cn(
                  "rounded-md px-1.5 text-[0.6875rem] tabular-nums",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {option.count}
              </span>
            )}
          </>
        );

        return option.href ? (
          <Link
            key={option.value}
            href={option.href}
            role="tab"
            aria-selected={active}
            className={itemClass}
          >
            {content}
          </Link>
        ) : (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(option.value)}
            className={itemClass}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
