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
import { CARD_NEON_THEMES, GROUP_DOT_CLASSES } from "@/lib/demands/demand-color";
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

const STATUS_THEME_MAP: Record<WebDemandStatus, keyof typeof CARD_NEON_THEMES> = {
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
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-background to-background p-5 shadow-[0_0_40px_rgba(52,211,153,0.06)]">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
        <TrendingUp className="size-5 text-emerald-400" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-emerald-400/70">
          Vendas em {monthLabel}
        </p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-emerald-300">
          {formatCurrency(total)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[0.6875rem] text-muted-foreground/50">
          {withValue.length} demanda{withValue.length !== 1 ? "s" : ""} com valor
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground/40">
          {monthDemands.length} no total
        </p>
      </div>
    </div>
  );
}

// ─── Micro Task List ──────────────────────────────────────────────────────────

function MicroTaskList({
  tasks,
  themeKey,
  onToggle,
  onAdd,
  onDelete,
}: {
  tasks: MicroTask[];
  themeKey: keyof typeof CARD_NEON_THEMES;
  onToggle: (taskId: string) => void;
  onAdd: (title: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = CARD_NEON_THEMES[themeKey];

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
      <div className="h-px bg-border/30 mb-2" />

      {tasks.map((task) => (
        <div key={task.id} className="group/task flex items-center gap-2 py-0.5">
          <button
            onClick={() => onToggle(task.id)}
            className="shrink-0 transition-colors"
            title={task.done ? "Marcar como pendente" : "Marcar como concluída"}
          >
            {task.done ? (
              <CheckCircle2 className={cn("size-3.5", theme.accent)} />
            ) : (
              <Circle className="size-3.5 text-muted-foreground/35 hover:text-muted-foreground/70" />
            )}
          </button>
          <span
            className={cn(
              "flex-1 text-[0.75rem] leading-tight",
              task.done ? "line-through text-muted-foreground/40" : "text-foreground/80"
            )}
          >
            {task.title}
          </span>
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0 text-muted-foreground/30 hover:text-red-400"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-0.5">
        <Plus className="size-3 shrink-0 text-muted-foreground/30" />
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Nova micro task..."
          className="flex-1 bg-transparent text-[0.75rem] text-foreground/70 placeholder:text-muted-foreground/30 focus:outline-none focus:placeholder:text-muted-foreground/50"
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
      <div className="h-px bg-border/30" />

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
          className="flex-1 bg-transparent text-[0.75rem] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
        />
        {serviceValue !== undefined && (
          <span className={cn("text-[0.6875rem] font-medium tabular-nums shrink-0", theme.accent)}>
            {formatCurrency(serviceValue)}
          </span>
        )}
      </div>

      {/* Payment note */}
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 text-[0.5625rem] uppercase font-semibold tracking-wide shrink-0", theme.muted)}>
          obs
        </span>
        <input
          type="text"
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => e.key === "Enter" && commitValue()}
          placeholder="Como será pago..."
          className="flex-1 bg-transparent text-[0.75rem] text-foreground/70 placeholder:text-muted-foreground/30 focus:outline-none"
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
        "group relative cursor-grab overflow-hidden rounded-xl border p-3.5 transition-premium select-none active:cursor-grabbing",
        isDragging ? "opacity-40 scale-95" : "hover:-translate-y-0.5",
        theme.card
      )}
    >
      {/* Glow orb */}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 size-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity",
          theme.glowA
        )}
        aria-hidden
      />

      <div className="relative space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[0.8125rem] font-medium leading-snug tracking-tight text-foreground line-clamp-2 flex-1">
            {demand.title}
          </h3>
          <div
            className="flex items-center gap-1 shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
          >
            <button
              onClick={onDelete}
              className="flex size-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-400"
              title="Remover card"
            >
              <Trash2 className="size-3" />
            </button>
            <Grip className="size-3.5 mt-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
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
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium transition-colors",
                demand.serviceValue
                  ? `${theme.accent} bg-white/5 border border-white/8 hover:bg-white/8`
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 border border-dashed border-border/40 hover:border-border/60"
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
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium transition-colors",
                hasTasks
                  ? allDone
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : `${theme.accent} bg-white/5 border border-white/8 hover:bg-white/8`
                  : "text-muted-foreground/40 hover:text-muted-foreground/70 border border-dashed border-border/40 hover:border-border/60"
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
            className="h-0.5 w-full rounded-full bg-white/8 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allDone ? "bg-emerald-400" : theme.accent.replace("text-", "bg-")
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
        className="w-full resize-none rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-[0.8125rem] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-colors"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="flex-1 rounded-lg bg-cyan-500/15 border border-cyan-500/25 px-3 py-1.5 text-[0.75rem] font-medium text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Adicionar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex size-7 items-center justify-center rounded-lg border border-border/50 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
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

  return (
    <div className="flex w-[272px] shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className={cn("size-2 shrink-0 rounded-full", column.dot)} />
        <h2 className={cn("text-xs font-semibold tracking-wide", column.header)}>
          {column.label}
        </h2>
        <span className="ml-auto text-[0.6875rem] tabular-nums text-muted-foreground/60">
          {demands.length}
        </span>
        <button
          onClick={() => setAdding(true)}
          className="flex size-5 items-center justify-center rounded-md border border-border/40 text-muted-foreground/50 hover:text-foreground hover:border-border/70 transition-colors"
          title={`Novo card em ${column.label}`}
        >
          <Plus className="size-3" />
        </button>
      </div>

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
            <div
              className="flex flex-col items-center justify-center py-8 text-center cursor-pointer"
              onClick={() => setAdding(true)}
            >
              <Inbox className="mb-2 size-5 text-muted-foreground/25" strokeWidth={1.25} />
              <p className="text-[0.6875rem] text-muted-foreground/40">Vazio</p>
            </div>
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

          {isOver && (
            <div className="h-1.5 w-full rounded-full bg-white/10 animate-pulse" />
          )}
        </div>
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
    <div className="space-y-0">
      <MonthlySalesCard demands={demands} />
      <div className="flex gap-4 overflow-x-auto pb-4">
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
