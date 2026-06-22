import type { CreativeDemandListItem } from "@/types/demand";

export type DemandColorState =
  | "red"
  | "amber"
  | "blue"
  | "green"
  | "gray"
  | "purple"
  | "cyan";

export type DemandGroup = {
  key: DemandColorState;
  label: string;
  priority: number;
};

export type DemandCardNeonTheme = {
  card: string;
  glowA: string;
  glowB: string;
  accent: string;
  muted: string;
  button: string;
  dot: string;
  header: string;
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
  if (status === "Revisão") return "purple";
  if (!demand.due_date) return "amber";
  if (status === "Nova") return "cyan";

  return "cyan";
}

export const COLOR_GROUP_MAP: Record<
  DemandColorState,
  { label: string; priority: number }
> = {
  red: { label: "Atrasadas", priority: 0 },
  blue: { label: "Em andamento", priority: 1 },
  purple: { label: "Em revisão", priority: 2 },
  cyan: { label: "Novas", priority: 3 },
  amber: { label: "Sem data de entrega", priority: 4 },
  green: { label: "Concluídas", priority: 5 },
  gray: { label: "Canceladas", priority: 6 },
};

export const CARD_NEON_THEMES: Record<DemandColorState, DemandCardNeonTheme> = {
  red: {
    card: "border-red-500/30 bg-gradient-to-br from-card/85 via-background to-red-50/80 shadow-[0_0_32px_rgba(239,68,68,0.08)] dark:to-red-950/30 dark:shadow-[0_0_48px_rgba(239,68,68,0.12)]",
    glowA: "bg-red-500/10 dark:bg-red-500/15",
    glowB: "bg-orange-500/8 dark:bg-orange-500/10",
    accent: "text-red-600 dark:text-red-300",
    muted: "text-red-600/70 dark:text-red-200/60",
    button:
      "border-red-500/35 bg-black/5 text-foreground hover:border-red-400/50 hover:bg-red-500/10 hover:shadow-[0_0_16px_rgba(239,68,68,0.12)] dark:bg-black/20 dark:hover:shadow-[0_0_16px_rgba(239,68,68,0.15)]",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)] dark:bg-red-400 dark:shadow-[0_0_10px_rgba(248,113,113,0.8)]",
    header: "text-red-600 dark:text-red-300",
  },
  amber: {
    card: "border-amber-500/30 bg-gradient-to-br from-card/85 via-background to-amber-50/80 shadow-[0_0_32px_rgba(251,191,36,0.07)] dark:to-amber-950/25 dark:shadow-[0_0_48px_rgba(251,191,36,0.1)]",
    glowA: "bg-amber-400/10 dark:bg-amber-400/15",
    glowB: "bg-orange-500/8 dark:bg-orange-500/10",
    accent: "text-amber-700 dark:text-amber-300",
    muted: "text-amber-700/70 dark:text-amber-200/60",
    button:
      "border-amber-500/35 bg-black/5 text-foreground hover:border-amber-400/50 hover:bg-amber-500/10 hover:shadow-[0_0_16px_rgba(251,191,36,0.12)] dark:bg-black/20 dark:hover:shadow-[0_0_16px_rgba(251,191,36,0.15)]",
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)] dark:bg-amber-400 dark:shadow-[0_0_10px_rgba(251,191,36,0.75)]",
    header: "text-amber-700 dark:text-amber-300",
  },
  blue: {
    card: "border-blue-500/30 bg-gradient-to-br from-card/85 via-background to-blue-50/80 shadow-[0_0_32px_rgba(59,130,246,0.08)] dark:to-blue-950/30 dark:shadow-[0_0_48px_rgba(59,130,246,0.12)]",
    glowA: "bg-blue-500/10 dark:bg-blue-500/15",
    glowB: "bg-cyan-500/8 dark:bg-cyan-500/10",
    accent: "text-blue-600 dark:text-blue-300",
    muted: "text-blue-600/70 dark:text-blue-200/60",
    button:
      "border-blue-500/35 bg-black/5 text-foreground hover:border-blue-400/50 hover:bg-blue-500/10 hover:shadow-[0_0_16px_rgba(59,130,246,0.12)] dark:bg-black/20 dark:hover:shadow-[0_0_16px_rgba(59,130,246,0.15)]",
    dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)] dark:bg-blue-400 dark:shadow-[0_0_10px_rgba(96,165,250,0.8)]",
    header: "text-blue-600 dark:text-blue-300",
  },
  purple: {
    card: "border-violet-500/30 bg-gradient-to-br from-card/85 via-background to-violet-50/80 shadow-[0_0_32px_rgba(139,92,246,0.08)] dark:to-violet-950/30 dark:shadow-[0_0_48px_rgba(139,92,246,0.12)]",
    glowA: "bg-violet-500/10 dark:bg-violet-500/15",
    glowB: "bg-fuchsia-500/8 dark:bg-fuchsia-500/10",
    accent: "text-violet-600 dark:text-violet-300",
    muted: "text-violet-600/70 dark:text-violet-200/60",
    button:
      "border-violet-500/35 bg-black/5 text-foreground hover:border-violet-400/50 hover:bg-violet-500/10 hover:shadow-[0_0_16px_rgba(139,92,246,0.12)] dark:bg-black/20 dark:hover:shadow-[0_0_16px_rgba(139,92,246,0.15)]",
    dot: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.45)] dark:bg-violet-400 dark:shadow-[0_0_10px_rgba(167,139,250,0.8)]",
    header: "text-violet-600 dark:text-violet-300",
  },
  cyan: {
    card: "border-cyan-500/25 bg-gradient-to-br from-card/85 via-background to-cyan-50/80 shadow-[0_0_32px_rgba(34,211,238,0.07)] dark:to-cyan-950/25 dark:shadow-[0_0_48px_rgba(34,211,238,0.1)]",
    glowA: "bg-cyan-500/10 dark:bg-cyan-500/12",
    glowB: "bg-violet-500/8 dark:bg-violet-500/10",
    accent: "text-cyan-700 dark:text-cyan-300",
    muted: "text-cyan-700/70 dark:text-cyan-200/55",
    button:
      "border-cyan-500/35 bg-black/5 text-foreground hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:shadow-[0_0_16px_rgba(34,211,238,0.12)] dark:bg-black/20 dark:hover:shadow-[0_0_16px_rgba(34,211,238,0.15)]",
    dot: "bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.45)] dark:bg-cyan-400 dark:shadow-[0_0_10px_rgba(34,211,238,0.75)]",
    header: "text-cyan-700 dark:text-cyan-300",
  },
  green: {
    card: "border-emerald-500/30 bg-gradient-to-br from-card/85 via-background to-emerald-50/80 shadow-[0_0_32px_rgba(52,211,153,0.07)] dark:to-emerald-950/25 dark:shadow-[0_0_48px_rgba(52,211,153,0.1)]",
    glowA: "bg-emerald-500/10 dark:bg-emerald-500/12",
    glowB: "bg-teal-500/8 dark:bg-teal-500/10",
    accent: "text-emerald-600 dark:text-emerald-300",
    muted: "text-emerald-600/70 dark:text-emerald-200/55",
    button:
      "border-emerald-500/35 bg-black/5 text-foreground hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:shadow-[0_0_16px_rgba(52,211,153,0.12)] dark:bg-black/20 dark:hover:shadow-[0_0_16px_rgba(52,211,153,0.15)]",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.45)] dark:bg-emerald-400 dark:shadow-[0_0_10px_rgba(52,211,153,0.75)]",
    header: "text-emerald-600 dark:text-emerald-300",
  },
  gray: {
    card: "border-zinc-500/25 bg-gradient-to-br from-card/70 via-background to-zinc-100/80 opacity-90 shadow-[0_0_20px_rgba(113,113,122,0.06)] dark:to-zinc-950/20 dark:opacity-75 dark:shadow-[0_0_24px_rgba(113,113,122,0.08)]",
    glowA: "bg-zinc-500/8 dark:bg-zinc-500/10",
    glowB: "bg-zinc-600/6 dark:bg-zinc-600/8",
    accent: "text-zinc-600 dark:text-zinc-400",
    muted: "text-zinc-500 dark:text-zinc-500",
    button:
      "border-zinc-500/30 bg-black/5 text-muted-foreground hover:border-zinc-400/40 hover:bg-zinc-500/10 dark:bg-black/15",
    dot: "bg-zinc-500 shadow-[0_0_6px_rgba(113,113,122,0.35)] dark:shadow-[0_0_8px_rgba(161,161,170,0.5)]",
    header: "text-zinc-600 dark:text-zinc-400",
  },
};

export const GROUP_HEADER_CLASSES: Record<DemandColorState, string> = {
  red: CARD_NEON_THEMES.red.header,
  amber: CARD_NEON_THEMES.amber.header,
  blue: CARD_NEON_THEMES.blue.header,
  purple: CARD_NEON_THEMES.purple.header,
  cyan: CARD_NEON_THEMES.cyan.header,
  green: CARD_NEON_THEMES.green.header,
  gray: CARD_NEON_THEMES.gray.header,
};

export const GROUP_DOT_CLASSES: Record<DemandColorState, string> = {
  red: CARD_NEON_THEMES.red.dot,
  amber: CARD_NEON_THEMES.amber.dot,
  blue: CARD_NEON_THEMES.blue.dot,
  purple: CARD_NEON_THEMES.purple.dot,
  cyan: CARD_NEON_THEMES.cyan.dot,
  green: CARD_NEON_THEMES.green.dot,
  gray: CARD_NEON_THEMES.gray.dot,
};
