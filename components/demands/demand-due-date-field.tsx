"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Pencil } from "lucide-react";
import { DemandDueDatePicker } from "@/components/demands/demand-due-date-picker";
import { cn } from "@/lib/utils";

function formatDueDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Campo "Entrega" da página da demanda: mostra e edita a data de entrega. */
export function DemandDueDateField({
  demandId,
  dueDate: initialDueDate,
  closed,
}: {
  demandId: string;
  dueDate: string | null;
  closed: boolean;
}) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState(initialDueDate);
  const overdue = !closed && Boolean(dueDate) && new Date(dueDate as string) < new Date();

  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">Entrega</dt>
      <dd className="flex items-center gap-1.5 text-sm font-semibold">
        <DemandDueDatePicker
          demandId={demandId}
          dueDate={dueDate}
          onChange={(next) => {
            setDueDate(next);
            router.refresh();
          }}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-md transition-colors",
            !dueDate
              ? "text-primary hover:underline"
              : overdue
                ? "text-tone-red hover:underline"
                : "text-foreground hover:text-primary"
          )}
        >
          <Calendar className="size-3.5 shrink-0" />
          <span className="truncate">
            {dueDate ? `${overdue ? "Atrasada · " : ""}${formatDueDate(dueDate)}` : "Definir data"}
          </span>
          {dueDate && (
            <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
          )}
        </DemandDueDatePicker>
      </dd>
    </div>
  );
}
