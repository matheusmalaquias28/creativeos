import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type PageLoadingProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function PageLoading({
  label = "Carregando...",
  className,
  compact = false,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        compact ? "min-h-[200px]" : "min-h-[50vh]",
        className
      )}
    >
      <div className="relative flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full border border-border/40 opacity-30" />
        <span className="absolute inset-1 animate-pulse rounded-full border border-border/60" />
        <div className="relative flex size-14 items-center justify-center rounded-xl border border-border/50 bg-card/50 backdrop-blur-md">
          <Brain
            className="size-6 text-foreground/80 animate-pulse-soft"
            strokeWidth={1.5}
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-foreground/90">{label}</p>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-loading-dot" />
          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-loading-dot [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-loading-dot [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
