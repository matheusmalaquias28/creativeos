"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  FolderOpen,
  Grip,
  Inbox,
  User,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { updateVideoDemandStatusAction } from "@/actions/video-demands";
import {
  getStatusColorState,
  CARD_NEON_THEMES,
  DEMAND_TONE,
} from "@/lib/demands/demand-color";
import { displayExternalClientName } from "@/lib/demands/normalize-client-name";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { clientInitials } from "@/lib/utils/client";
import {
  VIDEO_DEMAND_STATUSES,
  VIDEO_DEMAND_INITIAL_STATUS,
  VIDEO_DEMAND_QUEUE_STATUS,
  VIDEO_DEMAND_DONE_STATUS,
  isClosedStatus,
  type VideoDemandListItem,
  type VideoDemandStatus,
} from "@/types/video-demand";

const KNOWN_STATUSES = new Set<string>(VIDEO_DEMAND_STATUSES);

const UNKNOWN_STATUS_COLUMN = "__status_desconhecido__" as const;
type ColumnId = VideoDemandStatus | typeof UNKNOWN_STATUS_COLUMN;

function isUnknownStatus(d: VideoDemandListItem): boolean {
  return !d.status || !KNOWN_STATUSES.has(d.status);
}

const COLUMN_LABELS: Partial<Record<VideoDemandStatus, string>> = {
  "Aguardando Definição de Data": "Aguardando Data",
};

const COLUMNS: { status: ColumnId; label: string }[] = [
  ...VIDEO_DEMAND_STATUSES.map((status) => ({
    status,
    label: COLUMN_LABELS[status] ?? status,
  })),
  { status: UNKNOWN_STATUS_COLUMN, label: "Status Desconhecido" },
];

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

// ─── Card ──────────────────────────────────────────────────────────────────

function VideoCard({
  demand,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  demand: VideoDemandListItem;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const colorState = isOverdue(demand.due_date, demand.status)
    ? "red"
    : getStatusColorState(demand.status, Boolean(demand.due_date));
  const theme = CARD_NEON_THEMES[colorState];
  const overdue = isOverdue(demand.due_date, demand.status);
  const clientLabel =
    demand.client_name ||
    displayExternalClientName(demand.client_name_external) ||
    "Pendente de cadastro";
  const title = demand.briefing.titulo || "Demanda de vídeo";
  const qty = demand.briefing.quantidadeVideos;
  const prioridade = demand.prioridade || demand.briefing.prioridade;
  const externalStatus =
    demand.status && !KNOWN_STATUSES.has(demand.status) ? demand.status : null;

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
      <span
        aria-hidden
        className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", theme.bar)}
      />

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

        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-foreground/80">
            <Video className="size-2.5 shrink-0" />
            Vídeo
          </span>
          {prioridade && (
            <span className={cn(chipClass, tones.violet.badge)}>{prioridade}</span>
          )}
          {demand.categoria && (
            <span className="inline-flex max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-foreground/80">
              {demand.categoria}
            </span>
          )}
          {externalStatus && (
            <span className={cn(chipClass, tones.amber.badge)}>{externalStatus}</span>
          )}
        </div>

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
            {typeof qty === "number" && qty > 0 && (
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-semibold text-muted-foreground tabular-nums">
                {qty} {qty === 1 ? "vídeo" : "vídeos"}
              </span>
            )}
            {demand.drive_folder_url && (
              <a
                href={demand.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-premium hover:bg-primary hover:text-primary-foreground"
                title="Abrir pasta no Drive"
              >
                <FolderOpen className="size-3.5" />
              </a>
            )}
            <Link
              href={`/videos/${demand.id}`}
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

// ─── Column ──────────────────────────────────────────────────────────────────

const VISIBLE_CARDS_LIMIT = 5;

function Column({
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
  column: { status: ColumnId; label: string };
  demands: VideoDemandListItem[];
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  draggingId: string | null;
  onCardDragStart: (demand: VideoDemandListItem) => (e: React.DragEvent) => void;
  onCardDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleDemands = expanded ? demands : demands.slice(0, VISIBLE_CARDS_LIMIT);
  const hiddenCount = demands.length - visibleDemands.length;
  const colorState =
    column.status === UNKNOWN_STATUS_COLUMN
      ? "gray"
      : getStatusColorState(column.status);
  const t = tones[DEMAND_TONE[colorState]];

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
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
        <span className={cn("size-2 shrink-0 rounded-full", t.dot)} />
        <h2 className="truncate text-[0.8125rem] font-bold text-foreground">
          {column.label}
        </h2>
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
            <VideoCard
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

        {isOver && <div className="h-1.5 w-full animate-pulse rounded-full bg-primary/40" />}
      </div>
    </div>
  );
}

// ─── Board ─────────────────────────────────────────────────────────────────

export function VideoDemandsBoard({
  initialDemands,
}: {
  initialDemands: VideoDemandListItem[];
}) {
  const [demands, setDemands] = useState(initialDemands);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);
  const dragDemandRef = useRef<VideoDemandListItem | null>(null);

  useEffect(() => {
    if (!draggingId) setDemands(initialDemands);
  }, [initialDemands]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDemandsByStatus = useCallback(
    (status: ColumnId) => {
      if (status === UNKNOWN_STATUS_COLUMN) return demands.filter(isUnknownStatus);

      if (status === VIDEO_DEMAND_INITIAL_STATUS) {
        return demands.filter((d) => d.status === status && !d.due_date);
      }

      if (status === VIDEO_DEMAND_QUEUE_STATUS) {
        return demands.filter(
          (d) =>
            d.status === status ||
            (d.status === VIDEO_DEMAND_INITIAL_STATUS && Boolean(d.due_date))
        );
      }

      return demands.filter((d) => d.status === status);
    },
    [demands]
  );

  const handleCardDragStart = useCallback(
    (demand: VideoDemandListItem) => (e: React.DragEvent) => {
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
    (status: ColumnId) => (e: React.DragEvent) => {
      if (status === UNKNOWN_STATUS_COLUMN) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverColumn(status);
    },
    []
  );

  const handleColumnDragLeave = useCallback(() => setOverColumn(null), []);

  const handleColumnDrop = useCallback(
    (targetStatus: ColumnId) => async (e: React.DragEvent) => {
      if (targetStatus === UNKNOWN_STATUS_COLUMN) return;
      e.preventDefault();
      setOverColumn(null);

      const demand = dragDemandRef.current;
      if (!demand || demand.status === targetStatus) return;

      setDemands((prev) =>
        prev.map((d) => (d.id === demand.id ? { ...d, status: targetStatus } : d))
      );
      setDraggingId(null);
      dragDemandRef.current = null;

      const result = await updateVideoDemandStatusAction(demand.id, targetStatus);

      if (result.error) {
        setDemands((prev) =>
          prev.map((d) => (d.id === demand.id ? { ...d, status: demand.status } : d))
        );
        toast.error("Erro ao mover demanda", { description: result.error });
        return;
      }

      if (targetStatus === VIDEO_DEMAND_DONE_STATUS) {
        setTimeout(() => {
          setDemands((prev) => prev.filter((d) => d.id !== demand.id));
        }, 800);
        toast.success("Vídeo concluído", {
          description: "Movido para arquivados automaticamente.",
        });
      }
    },
    []
  );

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <Column
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
