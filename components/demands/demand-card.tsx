import Link from "next/link";
import { AlertTriangle, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreativeDemandListItem } from "@/types/demand";

function formatDate(value: string | null): string {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DemandCard({ demand }: { demand: CreativeDemandListItem }) {
  const title = demand.briefing.titulo || demand.client_name_external;

  return (
    <article className="surface-panel flex flex-col gap-4 p-5 hover-lift">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-sm font-medium tracking-heading text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {demand.client_not_found
              ? demand.client_name_external
              : (demand.client_name ?? demand.client_name_external)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {demand.client_not_found && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="size-3" />
              Cliente não encontrado no CreativeOS
            </Badge>
          )}
          {demand.status && <Badge variant="secondary">{demand.status}</Badge>}
          {demand.tipo && <Badge variant="outline">{demand.tipo}</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {demand.gestor && (
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5" />
            {demand.gestor}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          {formatDate(demand.external_created_at ?? demand.created_at)}
        </span>
        <span>{demand.artes.length} arte(s)</span>
      </div>

      <Link
        href={`/demands/${demand.id}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
      >
        Ver demanda
      </Link>
    </article>
  );
}
