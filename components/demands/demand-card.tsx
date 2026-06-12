"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DemandStatusSelector } from "@/components/demands/demand-status-selector";
import {
  DemandClientLinker,
  type DemandClientOption,
} from "@/components/demands/demand-client-linker";
import {
  CARD_NEON_THEMES,
  getDemandColorState,
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

function DueDateLabel({
  dueDate,
  accentClass,
  mutedClass,
}: {
  dueDate: string | null;
  accentClass: string;
  mutedClass: string;
}) {
  if (!dueDate) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", accentClass)}>
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
        isOverdue ? cn(accentClass, "font-medium") : mutedClass
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
  const theme = CARD_NEON_THEMES[colorState];

  function handleClientLinked(linkedClientId: string, linkedClientName: string) {
    setClientNotFound(false);
    setClientId(linkedClientId);
    setClientName(linkedClientName);
    onClientLinked?.(demand.id, linkedClientId, linkedClientName);
  }

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition-premium hover:-translate-y-0.5 animate-in-soft",
        theme.card
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 size-40 rounded-full blur-3xl transition-opacity group-hover:opacity-100",
          theme.glowA
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-20 -left-12 size-36 rounded-full blur-3xl transition-opacity group-hover:opacity-100",
          theme.glowB
        )}
        aria-hidden
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-sm font-medium tracking-heading text-foreground">
              {title}
            </h3>
            <p className={cn("text-xs", theme.muted)}>
              {clientNotFound
                ? demand.client_name_external
                : (clientName ?? demand.client_name_external)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {demand.is_new && (
              <Badge className="gap-1 border border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)] hover:bg-cyan-500/20">
                <Sparkles className="size-3" />
                Nova
              </Badge>
            )}
            {clientNotFound && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-300"
              >
                <AlertTriangle className="size-3" />
                Sem cliente
              </Badge>
            )}
            {demand.tipo && (
              <Badge
                variant="outline"
                className="border-white/10 bg-black/20 text-[0.65rem] text-foreground/80"
              >
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

        <div className="flex flex-wrap items-center gap-3">
          <DemandStatusSelector
            demandId={demand.id}
            currentStatus={demand.status}
            onArchived={onArchived}
            onArchiveRevert={onArchiveRevert}
            onStatusUpdated={onStatusUpdated}
          />
          <span className={cn("text-xs tabular-nums", theme.muted)}>
            {demand.artes.length} arte(s)
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          {demand.gestor && (
            <span className={cn("inline-flex items-center gap-1.5", theme.muted)}>
              <User className="size-3.5" />
              {demand.gestor}
            </span>
          )}
          <DueDateLabel
            dueDate={demand.due_date}
            accentClass={theme.accent}
            mutedClass={theme.muted}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/demands/${demand.id}`}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-premium",
              theme.button
            )}
          >
            Ver demanda
          </Link>
        </div>
      </div>
    </article>
  );
}
