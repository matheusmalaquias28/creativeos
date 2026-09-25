import { layout } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const block = "rounded-2xl border border-border bg-card animate-pulse";
const line = "rounded-md bg-muted animate-pulse";

export default function DemandDetailLoading() {
  return (
    <div className={layout.maxWidth}>
      {/* Cabeçalho: voltar, título e ações */}
      <div className="px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 xl:px-10">
        <div className={cn(line, "mb-4 h-4 w-24")} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className={cn(line, "h-8 w-80 max-w-full rounded-lg")} />
          <div className="flex gap-2">
            <div className={cn(block, "h-9 w-32 rounded-xl")} />
            <div className={cn(block, "h-9 w-40 rounded-xl")} />
          </div>
        </div>
      </div>

      <div className={cn(layout.pageX, layout.pageY, layout.sectionGap)}>
        {/* Barra de status + detalhes */}
        <div className={cn(block, "h-48")} />

        {/* Briefing das artes */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-1.5">
              <div className={cn(line, "h-4 w-44")} />
              <div className={cn(line, "h-3 w-32")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={cn(block, "aspect-[3/4]")} />
            ))}
          </div>
        </div>

        {/* Logo e referências */}
        <div className={cn(block, "h-64")} />
      </div>
    </div>
  );
}
