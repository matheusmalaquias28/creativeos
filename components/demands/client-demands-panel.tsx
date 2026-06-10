import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-heading">Demandas do cliente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Briefings recebidos via Make
          </p>
        </div>
        <Link
          href="/demands"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Ver todas
        </Link>
      </div>

      <div className="grid gap-3">
        {demands.slice(0, 3).map((demand) => (
          <div
            key={demand.id}
            className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium">
                {demand.briefing.titulo || demand.client_name_external}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(demand.external_created_at ?? demand.created_at)} ·{" "}
                {demand.artes.length} arte(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {demand.status && <Badge variant="secondary">{demand.status}</Badge>}
              <Link
                href={`/demands/${demand.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Abrir
              </Link>
            </div>
          </div>
        ))}
      </div>

      {demands.length > 3 && (
        <p className="text-xs text-muted-foreground">
          <ClipboardList className="mr-1 inline size-3.5" />
          +{demands.length - 3} demanda(s) adicionais na listagem geral
        </p>
      )}
    </section>
  );
}
