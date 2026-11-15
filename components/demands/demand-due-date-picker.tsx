"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateDemandDueDateAction } from "@/actions/demands";
import { cn } from "@/lib/utils";
import {
  addDays,
  dueDateToInputValue,
  inputValueToDueDate,
  monthGrid,
  todayInputValue,
  weekday,
} from "@/lib/demands/due-date";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthLabel(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month, 15)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function longLabel(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Próxima segunda-feira (a partir de amanhã). */
function nextMonday(today: string): string {
  const offset = ((8 - weekday(today)) % 7) || 7;
  return addDays(today, offset);
}

function parseYm(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m - 1 };
}

/**
 * Botão que abre um calendário (popover) e grava a data de entrega da demanda
 * (CreativeOS + callback para o WAR). O conteúdo visual do gatilho vem em
 * `children`, para cada lugar (kanban, card, página) manter o próprio estilo.
 */
export function DemandDueDatePicker({
  demandId,
  dueDate,
  onChange,
  className,
  children,
  title = "Definir data de entrega",
}: {
  demandId: string;
  dueDate: string | null;
  onChange?: (dueDate: string | null) => void;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = dueDateToInputValue(dueDate);
  const today = todayInputValue();
  const [view, setView] = useState(() => parseYm(selected || today));

  function save(next: string | null) {
    const previous = dueDate;
    onChange?.(next); // otimista
    startTransition(async () => {
      const result = await updateDemandDueDateAction(demandId, next);
      if (result.error) {
        onChange?.(previous);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Data de entrega atualizada" : "Data de entrega removida");
    });
  }

  function pick(value: string) {
    setOpen(false);
    if (value === selected) return;
    const next = inputValueToDueDate(value);
    if (next) save(next);
  }

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      const date = new Date(Date.UTC(year, month + delta, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });
  }

  const shortcuts = [
    { label: "Hoje", value: today },
    { label: "Amanhã", value: addDays(today, 1) },
    { label: "Seg. que vem", value: nextMonday(today) },
    { label: "Em 7 dias", value: addDays(today, 7) },
  ];

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setView(parseYm(selected || today));
        setOpen(next);
      }}
    >
      <Popover.Trigger
        draggable={false}
        disabled={pending}
        title={title}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn("cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-wait", className)}
      >
        {children}
        {pending && <Loader2 className="size-3 animate-spin" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50 outline-none">
          <Popover.Popup
            onClick={(e) => e.stopPropagation()}
            className="w-[17.5rem] origin-(--transform-origin) rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-[var(--surface-shadow-elevated)] outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="mb-3 space-y-0.5 px-0.5">
              <Popover.Title className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                Data de entrega
              </Popover.Title>
              <p className="text-sm font-semibold text-foreground">
                {selected ? longLabel(selected) : "Sem data definida"}
              </p>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => pick(s.value)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors",
                    s.value === selected
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-border-strong hover:bg-accent"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Mês anterior"
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-[0.8125rem] font-semibold text-foreground">
                {monthLabel(view.year, view.month)}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Próximo mês"
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="pb-1 text-[0.625rem] font-semibold text-muted-foreground/70">
                  {d}
                </span>
              ))}
              {monthGrid(view.year, view.month).map((day) => {
                const inMonth = parseYm(day).month === view.month;
                const isSelected = day === selected;
                const isToday = day === today;
                const isPast = day < today;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    aria-label={longLabel(day)}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-lg text-xs tabular-nums transition-colors",
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                        : cn(
                            "hover:bg-accent",
                            !inMonth && "text-muted-foreground/35",
                            inMonth && isPast && "text-muted-foreground/60",
                            inMonth && !isPast && "text-foreground",
                            isToday && "font-semibold text-primary"
                          )
                    )}
                  >
                    {Number(day.slice(8))}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="mt-3 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    save(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-tone-red/10 hover:text-tone-red"
                >
                  <Trash2 className="size-3.5" />
                  Remover data
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
