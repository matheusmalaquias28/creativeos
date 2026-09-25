"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Calendar, Grip, Inbox, User } from "lucide-react";
import { toast } from "sonner";
import { updateDemandStatusAction } from "@/actions/demands";
import {
  getDemandColorState,
  getStatusColorState,
  CARD_NEON_THEMES,
  DEMAND_TONE,
  type DemandColorState,
} from "@/lib/demands/demand-color";
import { displayExternalClientName } from "@/lib/demands/normalize-client-name";
import { getDemandCardTitle, getDemandCardTipo } from "@/lib/demands/demand-card-copy";
import { isMateriaisEditadosMissing } from "@/lib/export/drive-folder";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { clientInitials } from "@/lib/utils/client";
import type { DemandClientOption } from "@/components/demands/demand-client-linker";
import {
  DEMAND_STATUSES,
  DEMAND_INITIAL_STATUS,
  DEMAND_QUEUE_STATUS,
  DEMAND_DONE_STATUS,
  isClosedStatus,
  type CreativeDemandListItem,
  type DemandStatus,
} from "@/types/demand";

// ─── Known statuses ──────────────────────────────────────────────────────────

const KNOWN_STATUSES = new Set<string>(DEMAND_STATUSES);

/**
 * Coluna à parte para status nulos/"custom" que o WAR pode mandar e que não
 * têm coluna própria no vocabulário fixo. Nunca cai no card inicial — só aqui.
 */
const UNKNOWN_STATUS_COLUMN = "__status_desconhecido__" as const;
type KanbanColumnId = DemandStatus | typeof UNKNOWN_STATUS_COLUMN;

function isUnknownStatus(d: CreativeDemandListItem): boolean {
  return !d.status || !KNOWN_STATUSES.has(d.status);
}

// ─── Column config ───────────────────────────────────────────────────────────

type KanbanColumn = {
  status: KanbanColumnId;
  label: string;
  color: DemandColorState;
};

/** Rótulos curtos para os cabeçalhos das colunas (o status completo é longo). */
const COLUMN_LABELS: Partial<Record<DemandStatus, string>> = {
  "Aguardando Definição de Data": "Aguardando Data",
};

const COLUMNS: KanbanColumn[] = [
  ...DEMAND_STATUSES.map((status) => ({
    status,
    label: COLUMN_LABELS[status] ?? status,
    color: getStatusColorState(status),
  })),
  {
    status: UNKNOWN_STATUS_COLUMN,
    label: "Status Desconhecido",
    color: "gray",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function isOverdue(dueDate: string | null, status: string | null): boolean {
  if (!dueDate || isClosedStatus(status)) return false;
  return new Date(dueDate) < new Date();
}

const chipClass =
  "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold";

// ─── Compact Kanban Card ──────────────────────────────────────────────────────

function KanbanCard({
  demand,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  demand: CreativeDemandListItem;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const colorState = getDemandColorState(demand);
  const theme = CARD_NEON_THEMES[colorState];
  const overdue = isOverdue(demand.due_date, demand.status);
  const clientLabel =
    demand.client_name ||
    displayExternalClientName(demand.client_name_external) ||
    "Pendente de cadastro";
  const title = getDemandCardTitle(demand);
  const tipo = getDemandCardTipo(demand);
  const missingMateriaisEditados = isMateriaisEditadosMissing(demand.briefing);
  const missingClientMaterials =
    Boolean(demand.client_id) && demand.client_materials_ready === false;
  const externalStatus = demand.status && !KNOWN_STATUSES.has(demand.status) ? demand.status : null;
  const artesCount = demand.artes_count ?? demand.artes.length;
  const hasChips = Boolean(tipo || missingMateriaisEditados || missingClientMaterials || externalStatus);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative cursor-grab overflow-hidden rounded-xl border p-3.5 pl-4 transition-premium select-none active:cursor-grabbing",
        isDragging ? "scale-95 opacity-40" : "hover:-translate-y-0.5",
        theme.card
      )}
    >
      {/* Acento do estado (atrasada, em andamento, revisão…) */}
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", theme.bar)} />

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[0.5625rem] font-bold text-muted-foreground">
              {clientInitials(clientLabel)}
            </span>
            <p className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              <span className="truncate">{clientLabel}</span>
              {demand.client_not_found && (
                <AlertTriangle className="size-3 shrink-0 text-tone-amber" />
              )}
            </p>
          </div>
          <Grip className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </div>

        <h3 className="line-clamp-2 text-[0.8125rem] leading-snug font-semibold tracking-tight text-foreground">
          {title}
        </h3>

        {hasChips && (
          <div className="flex flex-wrap gap-1">
            {tipo && (
              <span className="inline-flex max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-foreground/80">
                {tipo}
              </span>
            )}

            {missingMateriaisEditados && (
              <span
                title="Demanda sem link de Materiais Editados"
                className={cn(chipClass, tones.amber.badge)}
              >
                <AlertTriangle className="size-2.5 shrink-0" />
                Sem Materiais Editados
              </span>
            )}

            {missingClientMaterials && (
              <Link
                href={`/clients/${demand.client_id}/onboarding`}
                onClick={(e) => e.stopPropagation()}
                title="Cliente sem logo/DNA visual/referências cadastrados — geração de artes bloqueada"
                className={cn(chipClass, tones.amber.badge, "transition-colors hover:border-tone-amber/50")}
              >
                <AlertTriangle className="size-2.5 shrink-0" />
                Materiais do cliente pendentes
              </Link>
            )}

            {/* Status externo (quando não é padrão do sistema) */}
            {externalStatus && (
              <span className={cn(chipClass, tones.amber.badge)}>{externalStatus}</span>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            {demand.gestor && (
              <span className="inline-flex min-w-0 items-center gap-1 text-[0.6875rem] text-muted-foreground">
                <User className="size-3 shrink-0" />
                <span className="truncate">{demand.gestor}</span>
              </span>
            )}
            {demand.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[0.6875rem]",
                  overdue
                    ? cn("rounded-md border px-1.5 py-px font-semibold", tones.red.badge)
                    : "text-muted-foreground"
                )}
                title={overdue ? "Atrasada" : "Prazo"}
              >
                <Calendar className="size-3" />
                {formatDate(demand.due_date)}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {artesCount > 0 && (
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-semibold text-muted-foreground tabular-nums">
                {artesCount} {artesCount === 1 ? "arte" : "artes"}
              </span>
            )}
            <Link
              href={`/demands/${demand.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-premium hover:bg-primary hover:text-primary-foreground"
              title="Ver demanda"
            >
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

/** Cards empilhados por coluna antes de precisar clicar em "Ver mais" — evita
 * colunas gigantes que jogam a barra de rolagem horizontal pro fim da página. */
const VISIBLE_CARDS_LIMIT = 5;

function KanbanColumn({
  column,
  demands,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingId,
  onCardDragStart,
  onCardDragEnd,
}: {
  column: KanbanColumn;
  demands: CreativeDemandListItem[];
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  draggingId: string | null;
  onCardDragStart: (demand: CreativeDemandListItem) => (e: React.DragEvent) => void;
  onCardDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleDemands = expanded ? demands : demands.slice(0, VISIBLE_CARDS_LIMIT);
  const hiddenCount = demands.length - visibleDemands.length;
  const t = tones[DEMAND_TONE[column.color]];

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex w-[288px] shrink-0 flex-col rounded-2xl border border-border bg-surface transition-all duration-200",
        isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
        <span className={cn("size-2 shrink-0 rounded-full", t.dot)} />
        <h2 className="truncate text-[0.8125rem] font-bold text-foreground">{column.label}</h2>
        <span
          className={cn(
            "ml-auto rounded-md border px-1.5 py-px text-[0.6875rem] font-bold tabular-nums",
            demands.length > 0 ? t.badge : "border-transparent bg-muted text-muted-foreground"
          )}
        >
          {demands.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        {demands.length === 0 && !isOver ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
            <Inbox className="mb-1.5 size-5 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="text-[0.6875rem] text-muted-foreground/70">Vazio</p>
          </div>
        ) : (
          visibleDemands.map((demand) => (
            <KanbanCard
              key={demand.id}
              demand={demand}
              isDragging={demand.id === draggingId}
              onDragStart={onCardDragStart(demand)}
              onDragEnd={onCardDragEnd}
            />
          ))
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-xl border border-dashed border-border-strong py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Ver mais {hiddenCount}
          </button>
        )}

        {expanded && demands.length > VISIBLE_CARDS_LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-xl border border-dashed border-border-strong py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Ver menos
          </button>
        )}

        {/* Drop target indicator */}
        {isOver && <div className="h-1.5 w-full animate-pulse rounded-full bg-primary/40" />}
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

type Props = {
  initialDemands: CreativeDemandListItem[];
  clients: DemandClientOption[];
};

export function DemandsKanbanBoard({ initialDemands }: Props) {
  const [demands, setDemands] = useState(initialDemands);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Sincroniza quando o servidor envia dados novos (ex: nova demanda via realtime + router.refresh)
  useEffect(() => {
    if (!draggingId) {
      setDemands(initialDemands);
    }
  }, [initialDemands]); // eslint-disable-line react-hooks/exhaustive-deps
  const [overColumn, setOverColumn] = useState<KanbanColumnId | null>(null);
  const dragDemandRef = useRef<CreativeDemandListItem | null>(null);

  const getDemandsByStatus = useCallback(
    (status: KanbanColumnId) => {
      // Status nulo/"custom" do WAR: sempre vai para a coluna à parte, nunca
      // para o card inicial — mesmo sem data de entrega.
      if (status === UNKNOWN_STATUS_COLUMN) {
        return demands.filter(isUnknownStatus);
      }

      if (status === DEMAND_INITIAL_STATUS) {
        // Só fica no 1º card quem tem o status inicial E ainda não tem data de
        // entrega — assim que o WAR define a data, a demanda passa para "Em
        // Fila" mesmo que o status em si ainda não tenha mudado por lá.
        return demands.filter((d) => d.status === status && !d.due_date);
      }

      if (status === DEMAND_QUEUE_STATUS) {
        return demands.filter(
          (d) =>
            d.status === status ||
            (d.status === DEMAND_INITIAL_STATUS && Boolean(d.due_date))
        );
      }

      return demands.filter((d) => d.status === status);
    },
    [demands]
  );

  const handleCardDragStart = useCallback(
    (demand: CreativeDemandListItem) => (e: React.DragEvent) => {
      dragDemandRef.current = demand;
      setDraggingId(demand.id);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setOverColumn(null);
    dragDemandRef.current = null;
  }, []);

  const handleColumnDragOver = useCallback(
    (status: KanbanColumnId) => (e: React.DragEvent) => {
      // A coluna de status desconhecido não é um destino válido — não dá para
      // "escolher" um status custom do WAR pelo Kanban.
      if (status === UNKNOWN_STATUS_COLUMN) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverColumn(status);
    },
    []
  );

  const handleColumnDragLeave = useCallback(() => {
    setOverColumn(null);
  }, []);

  const handleColumnDrop = useCallback(
    (targetStatus: KanbanColumnId) => async (e: React.DragEvent) => {
      if (targetStatus === UNKNOWN_STATUS_COLUMN) return;
      e.preventDefault();
      setOverColumn(null);

      const demand = dragDemandRef.current;
      if (!demand || demand.status === targetStatus) return;

      // Optimistic update
      setDemands((prev) =>
        prev.map((d) =>
          d.id === demand.id ? { ...d, status: targetStatus } : d
        )
      );
      setDraggingId(null);
      dragDemandRef.current = null;

      const result = await updateDemandStatusAction(demand.id, targetStatus);

      if (result.error) {
        // Revert on error
        setDemands((prev) =>
          prev.map((d) =>
            d.id === demand.id ? { ...d, status: demand.status } : d
          )
        );
        toast.error("Erro ao mover demanda", { description: result.error });
        return;
      }

      // Remove from kanban if archived (Concluído)
      if (targetStatus === DEMAND_DONE_STATUS) {
        setTimeout(() => {
          setDemands((prev) => prev.filter((d) => d.id !== demand.id));
        }, 800);
        toast.success("Demanda concluída", {
          description: "Movida para arquivadas automaticamente.",
        });
      }
    },
    []
  );

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          column={col}
          demands={getDemandsByStatus(col.status)}
          isOver={overColumn === col.status}
          draggingId={draggingId}
          onDragOver={handleColumnDragOver(col.status)}
          onDragLeave={handleColumnDragLeave}
          onDrop={handleColumnDrop(col.status)}
          onCardDragStart={handleCardDragStart}
          onCardDragEnd={handleCardDragEnd}
        />
      ))}
    </div>
  );
}
