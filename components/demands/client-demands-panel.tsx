import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { SectionHeader } from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DEMAND_TONE, getStatusColorState } from "@/lib/demands/demand-color";
import { cn } from "@/lib/utils";
import type { CreativeDemand } from "@/types/demand";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

export function ClientDemandsPanel({
  clientId,
  demands,
}: {
  clientId: string;
  demands: CreativeDemand[];
}) {
  if (demands.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={ClipboardList}
        tone="cyan"
        title="Demandas do cliente"
        description="Briefings recebidos via Make"
        action={
          <Link
            href="/demands"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ver todas
          </Link>
        }
      />

      <div className="grid gap-3">
        {demands.slice(0, 3).map((demand) => (
          <div
            key={demand.id}
            className="surface-panel hover-lift flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {demand.briefing.titulo || demand.client_name_external}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatDate(demand.external_created_at ?? demand.created_at)} ·{" "}
                {demand.artes.length} arte(s)
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

      {demands.length > 3 && (
        <p className="text-[0.8125rem] text-muted-foreground">
          <ClipboardList className="mr-1 inline size-3.5" />
          +{demands.length - 3} demanda(s) adicionais na listagem geral
        </p>
      )}
    </section>
  );
}
