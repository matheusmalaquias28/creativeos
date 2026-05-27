import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  className?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "surface-panel hover-lift flex flex-col gap-6 p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        <Icon
          className="size-4 shrink-0 text-muted-foreground/60"
          strokeWidth={1.5}
        />
      </div>
      <div>
        <p className="text-3xl font-medium tracking-heading tabular-nums text-foreground">
          {value}
        </p>
        {description && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
