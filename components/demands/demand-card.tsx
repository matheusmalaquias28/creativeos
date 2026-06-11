"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DemandStatusSelector } from "@/components/demands/demand-status-selector";
import {
  DemandClientLinker,
  type DemandClientOption,
} from "@/components/demands/demand-client-linker";
import {
  getDemandColorState,
  CARD_COLOR_CLASSES,
} from "@/lib/demands/demand-color";
import { cn } from "@/lib/utils";
import type { CreativeDemandListItem, DemandStatus } from "@/types/demand";

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

function DueDateLabel({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
        <Calendar className="size-3.5" />
        Definir prazo
      </span>
    );
  }
  const isOverdue = new Date(dueDate) < new Date();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"
      )}
    >
      <Calendar className="size-3.5" />
      {isOverdue ? "Atrasado · " : ""}
      {formatDate(dueDate)}
    </span>
  );
}

export function DemandCard({
  demand,
  clients = [],
  onArchived,
  onArchiveRevert,
  onStatusUpdated,
  onClientLinked,
}: {
  demand: CreativeDemandListItem;
  clients?: DemandClientOption[];
  onArchived?: () => void;
  onArchiveRevert?: () => void;
  onStatusUpdated?: (status: DemandStatus) => void;
  onClientLinked?: (demandId: string, clientId: string, clientName: string) => void;
}) {
  const [clientNotFound, setClientNotFound] = useState(demand.client_not_found);
  const [clientName, setClientName] = useState(demand.client_name ?? null);
  const [clientId, setClientId] = useState(demand.client_id);

  const title = demand.briefing.titulo || demand.client_name_external;
  const colorState = getDemandColorState({ ...demand, client_not_found: clientNotFound });
  const colorClass = CARD_COLOR_CLASSES[colorState];

  function handleClientLinked(linkedClientId: string, linkedClientName: string) {
    setClientNotFound(false);
    setClientId(linkedClientId);
    setClientName(linkedClientName);
    onClientLinked?.(demand.id, linkedClientId, linkedClientName);
  }

  return (
    <article
      className={cn(
        "surface-panel hover-lift flex flex-col gap-4 p-5 transition-all",
        colorClass
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-sm font-medium tracking-heading text-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {clientNotFound
              ? demand.client_name_external
              : (clientName ?? demand.client_name_external)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {demand.is_new && (
            <Badge className="gap-1 bg-indigo-500 text-white hover:bg-indigo-600">
              <Sparkles className="size-3" />
              Nova
            </Badge>
          )}
          {clientNotFound && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="size-3" />
              Sem cliente
            </Badge>
          )}
          {demand.tipo && (
            <Badge variant="outline" className="text-[0.65rem]">
              {demand.tipo}
            </Badge>
          )}
        </div>
      </div>

      {clientNotFound && (
        <DemandClientLinker
          demandId={demand.id}
          currentClientId={clientId}
          currentClientName={clientName}
          externalClientName={demand.client_name_external}
          clientNotFound={clientNotFound}
          clients={clients}
          compact
          onLinked={handleClientLinked}
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <DemandStatusSelector
          demandId={demand.id}
          currentStatus={demand.status}
          onArchived={onArchived}
          onArchiveRevert={onArchiveRevert}
          onStatusUpdated={onStatusUpdated}
        />
        <span className="text-xs text-muted-foreground">{demand.artes.length} arte(s)</span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {demand.gestor && (
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5" />
            {demand.gestor}
          </span>
        )}
        <DueDateLabel dueDate={demand.due_date} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/demands/${demand.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
        >
          Ver demanda
        </Link>
      </div>
    </article>
  );
}
