import { BrandMark } from "@/components/layout/brand-mark";
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
        <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
        <BrandMark size="lg" className="animate-pulse-soft" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold text-foreground/90">{label}</p>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-primary animate-loading-dot" />
          <span className="size-1.5 rounded-full bg-primary animate-loading-dot [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-primary animate-loading-dot [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
