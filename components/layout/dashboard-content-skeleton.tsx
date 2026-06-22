import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";

type DashboardContentSkeletonProps = {
  variant?: "default" | "grid" | "detail";
};

export function DashboardContentSkeleton({
  variant = "default",
}: DashboardContentSkeletonProps) {
  return (
    <div className={cn(layout.pageX, layout.pageY, "w-full animate-pulse")}>
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-72 max-w-full rounded bg-muted/70" />
      </div>

      <div className={cn("mt-10", layout.sectionGap)}>
        {variant === "detail" ? (
          <>
            <div className="h-12 rounded-xl bg-muted/80" />
            <div className="space-y-4">
              <div className="h-40 rounded-xl bg-muted/60" />
              <div className="h-40 rounded-xl bg-muted/60" />
              <div className="h-56 rounded-xl bg-muted/60" />
            </div>
          </>
        ) : variant === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-44 rounded-xl border border-border bg-card shadow-sm"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 rounded-xl bg-muted/60" />
              ))}
            </div>
            <div className="h-[420px] rounded-2xl bg-muted/50" />
            <div className="h-64 rounded-xl bg-muted/60" />
          </>
        )}
      </div>
    </div>
  );
}
