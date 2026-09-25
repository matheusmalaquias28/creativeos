import { layout } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const block = "rounded-2xl border border-border bg-card animate-pulse";
const line = "rounded-md bg-muted animate-pulse";

export default function DemandsLoading() {
  return (
    <div className={layout.maxWidth}>
      {/* Cabeçalho: título, descrição e filtro Ativas/Arquivadas */}
      <div className="px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 xl:px-10">
        <div className={cn(line, "h-8 w-48 rounded-lg")} />
        <div className={cn(line, "mt-2 h-4 w-96 max-w-full")} />
        <div className="mt-5 h-10 w-60 animate-pulse rounded-xl border border-border bg-surface" />
      </div>

      {/* Kanban */}
      <div className={cn(layout.pageX, layout.pageY)}>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, column) => (
            <div
              key={column}
              className="flex w-[288px] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <div className="flex items-center gap-2 px-1 py-1">
                <div className="size-2 animate-pulse rounded-full bg-muted" />
                <div className={cn(line, "h-4 w-28")} />
              </div>
              {Array.from({ length: 3 - (column % 2) }).map((_, card) => (
                <div key={card} className={cn(block, "h-32")} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
