"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  DollarSign,
  Grip,
  Inbox,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CARD_NEON_THEMES,
  DEMAND_TONE,
  type DemandColorState,
} from "@/lib/demands/demand-color";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebDemandStatus = "Nova" | "Fazendo" | "Revisão" | "Concluída" | "Cancelada";

export type MicroTask = {
  id: string;
  title: string;
  done: boolean;
};

export type WebDemand = {
  id: string;
  title: string;
  status: WebDemandStatus;
  createdAt: string;
  tasks: MicroTask[];
  serviceValue?: number;
  paymentNote?: string;
};

// ─── Column config ────────────────────────────────────────────────────────────

type KanbanColumn = {
  status: WebDemandStatus;
  label: string;
  /** Estado de cor — mesmo vocabulário (e tons) do Kanban de demandas. */
  color: DemandColorState;
};

const COLUMNS: KanbanColumn[] = [
  { status: "Nova", label: "Nova", color: "cyan" },
  { status: "Fazendo", label: "Em andamento", color: "blue" },
  { status: "Revisão", label: "Em revisão", color: "purple" },
  { status: "Concluída", label: "Concluída", color: "green" },
  { status: "Cancelada", label: "Cancelada", color: "gray" },
];

const STATUS_THEME_MAP: Record<WebDemandStatus, DemandColorState> = {
  Nova: "cyan",
  Fazendo: "blue",
  Revisão: "purple",
  Concluída: "green",
  Cancelada: "gray",
};

// ─── Local storage ────────────────────────────────────────────────────────────

const STORAGE_KEY = "creative-os:web-demands";

function loadFromStorage(): WebDemand[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebDemand[];
    return parsed.map((d) => ({ ...d, tasks: d.tasks ?? [] }));
  } catch {
    return [];
  }
}

function saveToStorage(demands: WebDemand[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demands));
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getCurrentMonthDemands(demands: WebDemand[]) {
  const now = new Date();
  return demands.filter((d) => {
    const created = new Date(d.createdAt);
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth()
    );
  });
}

// ─── Monthly Sales Card ───────────────────────────────────────────────────────

function MonthlySalesCard({ demands }: { demands: WebDemand[] }) {
  const monthDemands = getCurrentMonthDemands(demands);
  const total = monthDemands.reduce((acc, d) => acc + (d.serviceValue ?? 0), 0);
  const withValue = monthDemands.filter((d) => d.serviceValue && d.serviceValue > 0);
  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--surface-shadow),var(--inner-highlight)]">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          tones.green.iconTile
        )}
      >
        <TrendingUp className="size-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold text-muted-foreground first-letter:uppercase">
          Vendas em {monthLabel}
        </p>
        <p className="mt-0.5 text-2xl font-bold tracking-[-0.03em] text-foreground tabular-nums">
          {formatCurrency(total)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
            withValue.length > 0
              ? tones.green.badge
              : "border-transparent bg-muted text-muted-foreground"
          )}
        >
          {withValue.length} demanda{withValue.length !== 1 ? "s" : ""} com valor
        </span>
        <span className="inline-flex items-center rounded-full border border-transparent bg-muted px-2.5 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground tabular-nums">
          {monthDemands.length} no total
        </span>
      </div>
    </div>
  );
}

// ─── Micro Task List ──────────────────────────────────────────────────────────

function MicroTaskList({
  tasks,
  onToggle,
  onAdd,
  onDelete,
}: {
  tasks: MicroTask[];
  /** Mantido por compatibilidade — as tasks concluídas usam sempre o tom de sucesso. */
  themeKey: keyof typeof CARD_NEON_THEMES;
  onToggle: (taskId: string) => void;
  onAdd: (title: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const t = newTitle.trim();
      if (t) {
        onAdd(t);
        setNewTitle("");
      }
    }
    if (e.key === "Escape") {
      setNewTitle("");
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className="space-y-1 pt-1"
      onDragStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 h-px bg-border" />

      {tasks.map((task) => (
        <div key={task.id} className="group/task flex items-center gap-2 py-0.5">
          <button
            onClick={() => onToggle(task.id)}
            className="shrink-0 transition-colors"
            title={task.done ? "Marcar como pendente" : "Marcar como concluída"}
          >
            {task.done ? (
              <CheckCircle2 className={cn("size-3.5", tones.green.text)} />
            ) : (
              <Circle className="size-3.5 text-muted-foreground/60 hover:text-foreground" />
            )}
          </button>
          <span
            className={cn(
              "flex-1 text-[0.75rem] leading-tight",
              task.done ? "text-muted-foreground/70 line-through" : "text-foreground/85"
            )}
          >
            {task.title}
          </span>
          <button
            onClick={() => onDelete(task.id)}
            className="shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/task:opacity-100 hover:text-tone-red focus-visible:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-0.5">
        <Plus className="size-3 shrink-0 text-muted-foreground/60" />
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Nova micro task..."
          className="flex-1 bg-transparent text-[0.75rem] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Service Value Panel ──────────────────────────────────────────────────────

function ServiceValuePanel({
  serviceValue,
  paymentNote,
  themeKey,
  onChange,
}: {
  serviceValue?: number;
  paymentNote?: string;
  themeKey: keyof typeof CARD_NEON_THEMES;
  onChange: (value: number | undefined, note: string | undefined) => void;
}) {
  const [localValue, setLocalValue] = useState(
    serviceValue !== undefined ? String(serviceValue) : ""
  );
  const [localNote, setLocalNote] = useState(paymentNote ?? "");
  const theme = CARD_NEON_THEMES[themeKey];

  function commitValue() {
    const parsed = parseFloat(localValue.replace(",", "."));
    onChange(
      !localValue.trim() || isNaN(parsed) ? undefined : parsed,
      localNote.trim() || undefined
    );
  }

  return (
    <div
      className="space-y-2 pt-1"
      onDragStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="h-px bg-border" />

      {/* Value */}
      <div className="flex items-center gap-2">
        <DollarSign className={cn("size-3 shrink-0", theme.muted)} />
        <input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => e.key === "Enter" && commitValue()}
          placeholder="Valor do serviço"
          className="flex-1 bg-transparent text-[0.75rem] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        {serviceValue !== undefined && (
          <span className={cn("shrink-0 text-[0.6875rem] font-semibold tabular-nums", tones.green.text)}>
            {formatCurrency(serviceValue)}
          </span>
        )}
      </div>

      {/* Payment note */}
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 shrink-0 text-[0.625rem] font-semibold", theme.muted)}>
          Obs
        </span>
        <input
          type="text"
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => e.key === "Enter" && commitValue()}
          placeholder="Como será pago..."
          className="flex-1 bg-transparent text-[0.75rem] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function WebKanbanCard({
  demand,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateServiceValue,
}: {
  demand: WebDemand;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateServiceValue: (value: number | undefined, note: string | undefined) => void;
}) {
  const themeKey = STATUS_THEME_MAP[demand.status];
  const theme = CARD_NEON_THEMES[themeKey];
  const hasTasks = demand.tasks.length > 0;
  const doneTasks = demand.tasks.filter((t) => t.done).length;
  const totalTasks = demand.tasks.length;
  const allDone = hasTasks && doneTasks === totalTasks;

  const [tasksExpanded, setTasksExpanded] = useState(hasTasks);
  const [valueExpanded, setValueExpanded] = useState(
    !!(demand.serviceValue || demand.paymentNote)
  );

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
      {/* Acento do status */}
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", theme.bar)} />

      <div className="relative space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-[0.8125rem] leading-snug font-semibold tracking-tight text-foreground">
            {demand.title}
          </h3>
          <div
            className="flex items-center gap-1 shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
          >
            <button
              onClick={onDelete}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-premium group-hover:opacity-100 hover:bg-tone-red/12 hover:text-tone-red focus-visible:opacity-100"
              title="Remover card"
            >
              <Trash2 className="size-3" />
            </button>
            <Grip className="size-3.5 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
          </div>
        </div>

        {/* Meta row */}
        <div
          className="flex items-center justify-between gap-2"
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
        >
          <p className={cn("text-[0.625rem] tabular-nums", theme.muted)}>
            {new Date(demand.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </p>

          <div className="flex items-center gap-1.5">
            {/* Service value toggle */}
            <button
              onClick={() => setValueExpanded((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold transition-colors",
                demand.serviceValue
                  ? cn(tones.green.badge, "tabular-nums hover:border-tone-green/50")
                  : "border-dashed border-border-strong text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              title="Valor do serviço"
            >
              <DollarSign className="size-2.5" />
              {demand.serviceValue ? (
                <span>{formatCurrency(demand.serviceValue)}</span>
              ) : (
                <span>valor</span>
              )}
            </button>

            {/* Tasks toggle */}
            <button
              onClick={() => setTasksExpanded((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold transition-colors",
                hasTasks
                  ? allDone
                    ? tones.green.badge
                    : "border-transparent bg-muted text-foreground/80 tabular-nums hover:bg-accent"
                  : "border-dashed border-border-strong text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              title={tasksExpanded ? "Recolher tasks" : "Expandir tasks"}
            >
              {hasTasks ? (
                <>
                  <span>{doneTasks}/{totalTasks}</span>
                  <ChevronDown
                    className={cn(
                      "size-2.5 transition-transform duration-200",
                      tasksExpanded && "rotate-180"
                    )}
                  />
                </>
              ) : (
                <>
                  <Plus className="size-2.5" />
                  <span>tasks</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {hasTasks && (
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allDone ? tones.green.solid : theme.bar
              )}
              style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
            />
          </div>
        )}

        {/* Service value panel */}
        {valueExpanded && (
          <ServiceValuePanel
            serviceValue={demand.serviceValue}
            paymentNote={demand.paymentNote}
            themeKey={themeKey}
            onChange={onUpdateServiceValue}
          />
        )}

        {/* Micro tasks panel */}
        {tasksExpanded && (
          <MicroTaskList
            tasks={demand.tasks}
            themeKey={themeKey}
            onToggle={onToggleTask}
            onAdd={onAddTask}
            onDelete={onDeleteTask}
          />
        )}
      </div>
    </article>
  );
}

// ─── New Card Form ────────────────────────────────────────────────────────────

function NewCardForm({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const t = title.trim();
      if (t) onAdd(t);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (t) onAdd(t);
      }}
      className="space-y-2"
    >
      <textarea
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Título da demanda..."
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-[0.8125rem] text-foreground shadow-[var(--surface-shadow)] transition-premium placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-primary/60 focus:outline-none focus:ring-3 focus:ring-ring/20"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!title.trim()} className="flex-1">
          Adicionar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          title="Cancelar"
        >
          <X />
        </Button>
      </div>
    </form>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function WebKanbanColumn({
  column,
  demands,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingId,
  onCardDragStart,
  onCardDragEnd,
  onDelete,
  onAddCard,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateServiceValue,
}: {
  column: KanbanColumn;
  demands: WebDemand[];
  isOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  draggingId: string | null;
  onCardDragStart: (demand: WebDemand) => (e: React.DragEvent) => void;
  onCardDragEnd: () => void;
  onDelete: (id: string) => void;
  onAddCard: (title: string, status: WebDemandStatus) => void;
  onToggleTask: (demandId: string, taskId: string) => void;
  onAddTask: (demandId: string, title: string) => void;
  onDeleteTask: (demandId: string, taskId: string) => void;
  onUpdateServiceValue: (demandId: string, value: number | undefined, note: string | undefined) => void;
}) {
  const [adding, setAdding] = useState(false);
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
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-premium hover:bg-accent hover:text-foreground"
          title={`Novo card em ${column.label}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
        {adding && (
          <NewCardForm
            onAdd={(title) => {
              onAddCard(title, column.status);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {demands.length === 0 && !isOver && !adding ? (
          <button
            type="button"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center transition-colors hover:border-primary/40 hover:bg-card/60"
            onClick={() => setAdding(true)}
          >
            <Inbox className="mb-1.5 size-5 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="text-[0.6875rem] text-muted-foreground/70">Vazio · clique para adicionar</p>
          </button>
        ) : (
          demands.map((demand) => (
            <WebKanbanCard
              key={demand.id}
              demand={demand}
              isDragging={demand.id === draggingId}
              onDragStart={onCardDragStart(demand)}
              onDragEnd={onCardDragEnd}
              onDelete={() => onDelete(demand.id)}
              onToggleTask={(taskId) => onToggleTask(demand.id, taskId)}
              onAddTask={(title) => onAddTask(demand.id, title)}
              onDeleteTask={(taskId) => onDeleteTask(demand.id, taskId)}
              onUpdateServiceValue={(value, note) =>
                onUpdateServiceValue(demand.id, value, note)
              }
            />
          ))
        )}

        {demands.length > 0 && !adding && !isOver && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Adicionar card
          </button>
        )}

        {/* Drop target indicator */}
        {isOver && <div className="h-1.5 w-full animate-pulse rounded-full bg-primary/40" />}
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function WebDemandsKanbanBoard() {
  // Lazy initializer: carrega do localStorage na primeira renderização,
  // evitando o race condition onde o useEffect de salvar sobrescreve com [] antes do carregamento.
  const [demands, setDemands] = useState<WebDemand[]>(() => loadFromStorage());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<WebDemandStatus | null>(null);
  const dragDemandRef = useRef<WebDemand | null>(null);

  useEffect(() => {
    saveToStorage(demands);
  }, [demands]);

  const getDemandsByStatus = useCallback(
    (status: WebDemandStatus) => demands.filter((d) => d.status === status),
    [demands]
  );

  const handleAddCard = useCallback((title: string, status: WebDemandStatus) => {
    setDemands((prev) => [
      {
        id: crypto.randomUUID(),
        title,
        status,
        createdAt: new Date().toISOString(),
        tasks: [],
      },
      ...prev,
    ]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDemands((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleToggleTask = useCallback((demandId: string, taskId: string) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id !== demandId
          ? d
          : { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
      )
    );
  }, []);

  const handleAddTask = useCallback((demandId: string, title: string) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id !== demandId
          ? d
          : { ...d, tasks: [...d.tasks, { id: crypto.randomUUID(), title, done: false }] }
      )
    );
  }, []);

  const handleDeleteTask = useCallback((demandId: string, taskId: string) => {
    setDemands((prev) =>
      prev.map((d) =>
        d.id !== demandId ? d : { ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }
      )
    );
  }, []);

  const handleUpdateServiceValue = useCallback(
    (demandId: string, value: number | undefined, note: string | undefined) => {
      setDemands((prev) =>
        prev.map((d) =>
          d.id !== demandId ? d : { ...d, serviceValue: value, paymentNote: note }
        )
      );
    },
    []
  );

  const handleCardDragStart = useCallback(
    (demand: WebDemand) => (e: React.DragEvent) => {
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
    (status: WebDemandStatus) => (e: React.DragEvent) => {
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
    (targetStatus: WebDemandStatus) => (e: React.DragEvent) => {
      e.preventDefault();
      setOverColumn(null);

      const demand = dragDemandRef.current;
      if (!demand || demand.status === targetStatus) return;

      setDemands((prev) =>
        prev.map((d) => (d.id === demand.id ? { ...d, status: targetStatus } : d))
      );
      setDraggingId(null);
      dragDemandRef.current = null;
    },
    []
  );

  return (
    <div className="space-y-6">
      <MonthlySalesCard demands={demands} />
      <div className="flex items-start gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <WebKanbanColumn
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
            onDelete={handleDelete}
            onAddCard={handleAddCard}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onUpdateServiceValue={handleUpdateServiceValue}
          />
        ))}
      </div>
    </div>
  );
}
