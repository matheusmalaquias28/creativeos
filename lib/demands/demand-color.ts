import type { CreativeDemandListItem } from "@/types/demand";

export type DemandColorState = "red" | "amber" | "blue" | "green" | "gray" | "default";

export type DemandGroup = {
  key: DemandColorState;
  label: string;
  priority: number;
};

export function getDemandColorState(demand: CreativeDemandListItem): DemandColorState {
  const status = demand.status;
  const isClosed = status === "Concluída" || status === "Cancelada";

  if (!isClosed && demand.due_date) {
    const isOverdue = new Date(demand.due_date) < new Date();
    if (isOverdue) return "red";
  }

  if (status === "Concluída") return "green";
  if (status === "Cancelada") return "gray";
  if (status === "Fazendo") return "blue";
  if (!demand.due_date) return "amber";

  return "default";
}

export const COLOR_GROUP_MAP: Record<
  DemandColorState,
  { label: string; priority: number }
> = {
  red:     { label: "Atrasadas",         priority: 0 },
  blue:    { label: "Em andamento",      priority: 1 },
  default: { label: "Aguardando",        priority: 2 },
  amber:   { label: "Sem data de entrega", priority: 3 },
  green:   { label: "Concluídas",        priority: 4 },
  gray:    { label: "Canceladas",        priority: 5 },
};

export const CARD_COLOR_CLASSES: Record<DemandColorState, string> = {
  red:     "border-l-4 border-l-red-500/80 bg-red-500/5",
  amber:   "border-l-4 border-l-amber-400/80 bg-amber-400/5",
  blue:    "border-l-4 border-l-blue-500/80 bg-blue-500/5",
  green:   "border-l-4 border-l-emerald-500/80 bg-emerald-500/5",
  gray:    "border-l-4 border-l-zinc-400/60 opacity-60",
  default: "",
};

export const GROUP_HEADER_CLASSES: Record<DemandColorState, string> = {
  red:     "text-red-600 dark:text-red-400",
  amber:   "text-amber-600 dark:text-amber-400",
  blue:    "text-blue-600 dark:text-blue-400",
  green:   "text-emerald-600 dark:text-emerald-400",
  gray:    "text-zinc-500",
  default: "text-foreground",
};

export const GROUP_DOT_CLASSES: Record<DemandColorState, string> = {
  red:     "bg-red-500",
  amber:   "bg-amber-400",
  blue:    "bg-blue-500",
  green:   "bg-emerald-500",
  gray:    "bg-zinc-400",
  default: "bg-foreground/30",
};
