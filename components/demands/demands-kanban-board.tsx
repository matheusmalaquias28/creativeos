"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Calendar, Grip, Inbox, User } from "lucide-react";
import { toast } from "sonner";
import { updateDemandStatusAction } from "@/actions/demands";
import { getDemandColorState, CARD_NEON_THEMES, GROUP_DOT_CLASSES } from "@/lib/demands/demand-color";
import { cn } from "@/lib/utils";
import type { DemandClientOption } from "@/components/demands/demand-client-linker";
import type { CreativeDemandListItem, DemandStatus } from "@/types/demand";

// ─── Known statuses ──────────────────────────────────────────────────────────

const KNOWN_STATUSES = new Set(["Nova", "Fazendo", "Revisão", "Concluída", "Cancelada"]);

// ─── Column config ───────────────────────────────────────────────────────────

type KanbanColumn = {
  status: DemandStatus;
  label: string;
  dot: string;
  header: string;
  border: string;
  bg: string;
};

const COLUMNS: KanbanColumn[] = [
  {
    status: "Nova",
    label: "Nova",
    dot: GROUP_DOT_CLASSES.cyan,
    header: "text-cyan-400",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    bg: "dark:bg-cyan-500/3",
  },
  {
    status: "Fazendo",
    label: "Em andamento",
    dot: GROUP_DOT_CLASSES.blue,
    header: "text-blue-400",
    border: "border-blue-500/20 hover:border-blue-500/40",
    bg: "dark:bg-blue-500/3",
  },
  {
    status: "Revisão",
    label: "Em revisão",
    dot: GROUP_DOT_CLASSES.purple,
    header: "text-violet-400",
    border: "border-violet-500/20 hover:border-violet-500/40",
    bg: "dark:bg-violet-500/3",
  },
  {
    status: "Concluída",
    label: "Concluída",
    dot: GROUP_DOT_CLASSES.green,
    header: "text-emerald-400",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    bg: "dark:bg-emerald-500/3",
  },
  {
    status: "Cancelada",
    label: "Cancelada",
    dot: GROUP_DOT_CLASSES.gray,
    header: "text-zinc-500",
    border: "border-zinc-500/15 hover:border-zinc-500/30",
    bg: "dark:bg-zinc-500/2",
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
  if (!dueDate || status === "Concluída" || status === "Cancelada") return false;
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
  const title = demand.briefing.titulo || demand.client_name_external;

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
        {/* Title + drag handle */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[0.8125rem] font-medium leading-snug tracking-tight text-foreground line-clamp-2 flex-1">
            {title}
          </h3>
          <Grip className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        </div>

        {/* Client */}
        <p className={cn("text-[0.6875rem] truncate", theme.muted)}>
          {demand.client_name ?? demand.client_name_external}
          {demand.client_not_found && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400/80">
              <AlertTriangle className="size-3" />
            </span>
          )}
        </p>

        {/* Status externo (quando não é padrão do sistema) */}
        {demand.status && !KNOWN_STATUSES.has(demand.status) && (
          <span className="inline-block rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[0.5625rem] font-medium text-amber-400/90 truncate max-w-full">
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
            {demand.artes.length > 0 && (
              <span className="text-[0.5625rem] font-medium text-muted-foreground/60 tabular-nums">
                {demand.artes.length}
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
            demands.map((demand) => (
              <KanbanCard
                key={demand.id}
                demand={demand}
                isDragging={demand.id === draggingId}
                onDragStart={onCardDragStart(demand)}
                onDragEnd={onCardDragEnd}
              />
            ))
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
  const [overColumn, setOverColumn] = useState<DemandStatus | null>(null);
  const dragDemandRef = useRef<CreativeDemandListItem | null>(null);

  const getDemandsByStatus = useCallback(
    (status: DemandStatus) =>
      demands.filter((d) =>
        status === "Nova"
          ? d.status === "Nova" || !d.status || !KNOWN_STATUSES.has(d.status ?? "")
          : d.status === status
      ),
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
    (status: DemandStatus) => (e: React.DragEvent) => {
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
    (targetStatus: DemandStatus) => async (e: React.DragEvent) => {
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

      // Remove from kanban if archived (Concluída)
      if (targetStatus === "Concluída") {
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
