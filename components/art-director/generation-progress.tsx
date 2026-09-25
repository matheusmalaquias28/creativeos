import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProgressCounts = {
  total: number;
  done: number;
  working: number;
  failed: number;
};

type Props = {
  counts: ProgressCounts;
  label: string;
};

/**
 * Progresso do lote. Existe porque uma demanda de 5 artes leva ~20s dirigindo e
 * mais um tanto gerando — sem isso a tela fica parada e parece travada.
 */
export function GenerationProgress({ counts, label }: Props) {
  const { total, done, working, failed } = counts;
  if (total === 0 || working === 0) return null;

  const pct = Math.round((done / total) * 100);

  return (
    <div className="surface-panel space-y-2.5 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <Loader2 className="size-4 animate-spin text-tone-blue" />
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {done}/{total}
          {failed > 0 && <span className="ml-2 text-tone-red">{failed} falhou</span>}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            pct === 0 && "animate-pulse"
          )}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  );
}
