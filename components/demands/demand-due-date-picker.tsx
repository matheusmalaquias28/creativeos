"use client";

import { useRef, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateDemandDueDateAction } from "@/actions/demands";
import { cn } from "@/lib/utils";
import { dueDateToInputValue, inputValueToDueDate } from "@/lib/demands/due-date";

/**
 * Botão que abre o seletor nativo de data e grava a data de entrega da demanda
 * (CreativeOS + callback para o WAR). O conteúdo visual vem em `children`, para
 * cada lugar (kanban, card, página) manter o próprio estilo.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

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

  function openPicker(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        onMouseDown={(e) => e.stopPropagation()}
        draggable={false}
        disabled={pending}
        title={title}
        className={cn("cursor-pointer disabled:cursor-wait", className)}
      >
        {children}
        {pending && <Loader2 className="size-3 animate-spin" />}
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-label={title}
        value={dueDateToInputValue(dueDate)}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) {
            save(null);
            return;
          }
          const next = inputValueToDueDate(value);
          if (next && next !== dueDate) save(next);
        }}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  );
}
