import { cn } from "@/lib/utils";
import { layout } from "@/lib/design/tokens";

type DashboardContentSkeletonProps = {
  variant?: "default" | "grid" | "detail";
};

const block = "rounded-2xl border border-border bg-card";

export function DashboardContentSkeleton({
  variant = "default",
}: DashboardContentSkeletonProps) {
  return (
    <div className={cn(layout.maxWidth, "animate-pulse")}>
      <div className="space-y-3 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 xl:px-10">
        <div className="h-3.5 w-32 rounded-md bg-muted" />
        <div className="h-8 w-64 max-w-full rounded-lg bg-muted" />
        <div className="h-4 w-96 max-w-full rounded-md bg-muted/70" />
      </div>

      <div className={cn(layout.pageX, layout.pageY, layout.sectionGap)}>
        {variant === "detail" ? (
          <>
            <div className="h-12 w-80 max-w-full rounded-xl bg-muted/80" />
            <div className="grid gap-5 xl:grid-cols-3">
              <div className={cn(block, "h-72 xl:col-span-2")} />
              <div className={cn(block, "h-72")} />
            </div>
            <div className={cn(block, "h-56")} />
          </>
        ) : variant === "grid" ? (
          <>
            <div className="flex justify-between gap-4">
              <div className="h-10 w-56 rounded-xl bg-muted/80" />
              <div className="h-10 w-72 rounded-xl bg-muted/80" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className={cn(block, "h-56")} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={cn(block, "h-[9.5rem]")} />
              ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              <div className={cn(block, "h-[28rem] xl:col-span-2")} />
              <div className={cn(block, "h-[28rem]")} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
