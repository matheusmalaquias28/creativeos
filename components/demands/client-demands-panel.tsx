import Link from "next/link";
import { ArrowUpRight, ClipboardList, Archive } from "lucide-react";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DEMAND_TONE, getStatusColorState } from "@/lib/demands/demand-color";
import { getDemandCardTitle } from "@/lib/demands/demand-card-copy";
import { cn } from "@/lib/utils";
import type { CreativeDemand } from "@/types/demand";

/** Só demandas solicitadas nesse período podem ser abertas; as demais ficam como histórico. */
const OPENABLE_DAYS = 10;

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

/** Data de solicitação: quando a demanda foi criada no WAR, senão quando chegou aqui. */
function requestedAt(demand: CreativeDemand): string {
  return demand.external_created_at ?? demand.created_at;
}

function artCount(demand: CreativeDemand): number {
  return demand.artes.length || demand.briefing.quantidadeArtes || 0;
}

export function ClientDemandsPanel({
  demands,
}: {
  clientId: string;
  demands: CreativeDemand[];
}) {
  if (demands.length === 0) return null;

  const cutoff = Date.now() - OPENABLE_DAYS * 24 * 60 * 60 * 1000;
  const sorted = [...demands].sort(
    (a, b) => new Date(requestedAt(b)).getTime() - new Date(requestedAt(a)).getTime()
  );
  const recent = sorted.filter((d) => new Date(requestedAt(d)).getTime() >= cutoff);
  const older = sorted.filter((d) => new Date(requestedAt(d)).getTime() < cutoff);

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={ClipboardList}
        tone="cyan"
        title="Demandas do cliente"
        description={`${demands.length} demanda(s) vinculada(s) · abertura disponível para as dos últimos ${OPENABLE_DAYS} dias`}
        action={
          <Link
            href="/demands"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ver todas
          </Link>
        }
      />

      {recent.length > 0 && (
        <div className="grid gap-3">
          {recent.map((demand) => (
            <div
              key={demand.id}
              className="surface-panel hover-lift flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {getDemandCardTitle(demand)}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatDate(requestedAt(demand))} · {artCount(demand)} arte(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                {demand.status && (
                  <Badge variant={DEMAND_TONE[getStatusColorState(demand.status)]}>
                    {demand.status}
                  </Badge>
                )}
                <Link
                  href={`/demands/${demand.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Abrir
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {older.length > 0 && (
        <div className="surface-panel overflow-hidden">
          <p className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            <Archive className="size-3.5" />
            Histórico · {older.length} demanda(s) com mais de {OPENABLE_DAYS} dias
          </p>
          <ul className="divide-y divide-border">
            {older.map((demand) => (
              <li
                key={demand.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.8125rem]"
              >
                <span className="min-w-0 truncate text-foreground">{getDemandCardTitle(demand)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatDate(requestedAt(demand))} · {artCount(demand)} arte(s)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
