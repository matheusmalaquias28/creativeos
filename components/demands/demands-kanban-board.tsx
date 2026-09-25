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
  GROUP_DOT_CLASSES,
  type DemandColorState,
} from "@/lib/demands/demand-color";
import { displayExternalClientName } from "@/lib/demands/normalize-client-name";
import { getDemandCardTitle, getDemandCardTipo } from "@/lib/demands/demand-card-copy";
import { isMateriaisEditadosMissing } from "@/lib/export/drive-folder";
import { cn } from "@/lib/utils";
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
  dot: string;
  header: string;
  border: string;
  bg: string;
};

/** Rótulos curtos para os cabeçalhos das colunas (o status completo é longo). */
const COLUMN_LABELS: Partial<Record<DemandStatus, string>> = {
  "Aguardando Definição de Data": "Aguardando Data",
};

const COLUMN_STYLE: Record<
  DemandColorState,
  { header: string; border: string; bg: string }
> = {
  red: { header: "text-red-400", border: "border-red-500/20 hover:border-red-500/40", bg: "dark:bg-red-500/3" },
  amber: { header: "text-amber-400", border: "border-amber-500/20 hover:border-amber-500/40", bg: "dark:bg-amber-500/3" },
  blue: { header: "text-blue-400", border: "border-blue-500/20 hover:border-blue-500/40", bg: "dark:bg-blue-500/3" },
  purple: { header: "text-violet-400", border: "border-violet-500/20 hover:border-violet-500/40", bg: "dark:bg-violet-500/3" },
  cyan: { header: "text-cyan-400", border: "border-cyan-500/20 hover:border-cyan-500/40", bg: "dark:bg-cyan-500/3" },
  green: { header: "text-emerald-400", border: "border-emerald-500/20 hover:border-emerald-500/40", bg: "dark:bg-emerald-500/3" },
  gray: { header: "text-zinc-500", border: "border-zinc-500/15 hover:border-zinc-500/30", bg: "dark:bg-zinc-500/2" },
};

const COLUMNS: KanbanColumn[] = [
  ...DEMAND_STATUSES.map((status) => {
    const color = getStatusColorState(status);
    const style = COLUMN_STYLE[color];
    return {
      status,
      label: COLUMN_LABELS[status] ?? status,
      dot: GROUP_DOT_CLASSES[color],
      header: style.header,
      border: style.border,
      bg: style.bg,
    };
  }),
  {
    status: UNKNOWN_STATUS_COLUMN,
    label: "Status Desconhecido",
    dot: GROUP_DOT_CLASSES.gray,
    header: COLUMN_STYLE.gray.header,
    border: COLUMN_STYLE.gray.border,
    bg: COLUMN_STYLE.gray.bg,
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

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative cursor-grab overflow-hidden rounded-xl border p-3.5 transition-premium select-none active:cursor-grabbing",
        isDragging ? "opacity-40 scale-95" : "hover:-translate-y-0.5",
        theme.card
      )}
    >
      {/* Glow orbs */}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 size-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity",
          theme.glowA
        )}
        aria-hidden
      />

      <div className="relative space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className={cn("flex items-center gap-1 truncate text-[0.6875rem]", theme.muted)}>
              <span className="truncate">{clientLabel}</span>
              {demand.client_not_found && (
                <AlertTriangle className="size-3 shrink-0 text-amber-400/80" />
              )}
            </p>
            <h3 className="line-clamp-2 text-[0.8125rem] font-medium leading-snug tracking-tight text-foreground">
              {title}
            </h3>
          </div>
          <Grip className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
        </div>

        {tipo && (
          <span className="inline-flex max-w-full truncate rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.5625rem] font-medium text-foreground/80">
            {tipo}
          </span>
        )}

        {missingMateriaisEditados && (
          <span
            title="Demanda sem link de Materiais Editados"
            className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[0.5625rem] font-medium text-amber-400/90"
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
            className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[0.5625rem] font-medium text-amber-400/90 hover:border-amber-500/40"
          >
            <AlertTriangle className="size-2.5 shrink-0" />
            Materiais do cliente pendentes
          </Link>
        )}

        {/* Status externo (quando não é padrão do sistema) */}
        {demand.status && !KNOWN_STATUSES.has(demand.status) && (
          <span className="inline-flex max-w-full truncate rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[0.5625rem] font-medium text-amber-400/90">
            {demand.status}
          </span>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {demand.gestor && (
              <span className={cn("inline-flex items-center gap-1 text-[0.625rem]", theme.muted)}>
                <User className="size-3" />
                {demand.gestor}
              </span>
            )}
            {demand.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[0.625rem]",
                  overdue ? "text-red-400 font-medium" : theme.muted
                )}
              >
                <Calendar className="size-3" />
                {overdue && "⚠ "}
                {formatDate(demand.due_date)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(demand.artes_count ?? demand.artes.length) > 0 && (
              <span className="text-[0.5625rem] font-medium text-muted-foreground/60 tabular-nums">
                {demand.artes_count ?? demand.artes.length}
              </span>
            )}
            <Link
              href={`/demands/${demand.id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex size-6 items-center justify-center rounded-md border transition-premium opacity-0 group-hover:opacity-100",
                theme.button
              )}
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

  return (
    <div className="flex w-[272px] shrink-0 flex-col gap-3">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span className={cn("size-2 shrink-0 rounded-full", column.dot)} />
        <h2 className={cn("text-xs font-semibold tracking-wide", column.header)}>
          {column.label}
        </h2>
        <span className="ml-auto text-[0.6875rem] tabular-nums text-muted-foreground/60">
          {demands.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "min-h-[120px] flex-1 rounded-xl border transition-all duration-200",
          column.border,
          column.bg,
          "dark:bg-white/[0.015]",
          isOver && "ring-2 ring-inset dark:ring-white/15 scale-[1.01] bg-white/[0.02]"
        )}
      >
        <div className="flex flex-col gap-2.5 p-2.5">
          {demands.length === 0 && !isOver ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Inbox className="mb-2 size-5 text-muted-foreground/25" strokeWidth={1.25} />
              <p className="text-[0.6875rem] text-muted-foreground/40">Vazio</p>
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
              className="rounded-lg border border-dashed border-white/10 py-2 text-[0.6875rem] font-medium text-muted-foreground/70 transition-colors hover:border-white/20 hover:text-foreground"
            >
              Ver mais {hiddenCount}
            </button>
          )}

          {expanded && demands.length > VISIBLE_CARDS_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg border border-dashed border-white/10 py-2 text-[0.6875rem] font-medium text-muted-foreground/70 transition-colors hover:border-white/20 hover:text-foreground"
            >
              Ver menos
            </button>
          )}

          {/* Drop target indicator */}
          {isOver && (
            <div className="h-1.5 w-full rounded-full bg-white/10 animate-pulse" />
          )}
        </div>
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
    <div className="flex gap-4 overflow-x-auto pb-4">
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
