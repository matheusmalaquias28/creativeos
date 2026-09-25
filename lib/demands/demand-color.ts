import { isClosedStatus, type CreativeDemandListItem } from "@/types/demand";
import { tones, type Tone } from "@/lib/design/tokens";

export type DemandColorState =
  | "red"
  | "amber"
  | "blue"
  | "green"
  | "gray"
  | "purple"
  | "cyan";

/**
 * Mapa status → estado de cor. Cobre o vocabulário do WAR e os valores legados
 * ("Nova"/"Revisão"/"Concluída"/"Cancelada") de demandas antigas.
 */
const STATUS_COLOR: Record<string, DemandColorState> = {
  "Aguardando Definição de Data": "amber",
  "Em Fila": "cyan",
  Fazendo: "blue",
  "Aprovação de Copy": "purple",
  "Aprovação do Gestor": "purple",
  Ajuste: "purple",
  "Aprovação do Cliente": "purple",
  Aprovado: "green",
  Atrasado: "red",
  Concluído: "green",
  // Legado
  Nova: "cyan",
  Revisão: "purple",
  Concluída: "green",
  Cancelada: "gray",
};

export type DemandGroup = {
  key: DemandColorState;
  label: string;
  priority: number;
};

export type DemandCardNeonTheme = {
  /** Tom do design system correspondente ao estado. */
  tone: Tone;
  /** Barra de acento (lateral/topo) na cor do estado. */
  bar: string;
  /** Chip suave (borda + fundo + texto) na cor do estado. */
  badge: string;
  card: string;
  glowA: string;
  glowB: string;
  accent: string;
  muted: string;
  button: string;
  dot: string;
  header: string;
};

/** Estado de cor de um status isolado (sem considerar prazo). */
export function getStatusColorState(
  status: string | null | undefined,
  hasDueDate = true
): DemandColorState {
  if (status && STATUS_COLOR[status]) return STATUS_COLOR[status];
  // Status custom/desconhecido: cyan quando tem data, âmbar quando não tem.
  return hasDueDate ? "cyan" : "amber";
}

export function getDemandColorState(demand: CreativeDemandListItem): DemandColorState {
  const status = demand.status;

  if (!isClosedStatus(status) && demand.due_date) {
    const isOverdue = new Date(demand.due_date) < new Date();
    if (isOverdue) return "red";
  }

  return getStatusColorState(status, Boolean(demand.due_date));
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

/** Estado de cor → tom do design system (V2). */
export const DEMAND_TONE: Record<DemandColorState, Tone> = {
  red: "red",
  amber: "amber",
  blue: "blue",
  purple: "violet",
  cyan: "cyan",
  green: "green",
  gray: "slate",
};

function buildTheme(state: DemandColorState): DemandCardNeonTheme {
  const tone = DEMAND_TONE[state];
  const t = tones[tone];
  return {
    tone,
    bar: t.bar,
    badge: t.badge,
    card: [
      "border-border bg-card shadow-[var(--surface-shadow),var(--inner-highlight)] hover:border-border-strong hover:shadow-[var(--surface-shadow-hover),var(--inner-highlight)]",
      state === "gray" && "opacity-75",
    ]
      .filter(Boolean)
      .join(" "),
    // Os brilhos "neon" da V1 foram aposentados; mantidos vazios por compatibilidade.
    glowA: "hidden",
    glowB: "hidden",
    accent: t.text,
    muted: "text-muted-foreground",
    button: "border-border bg-secondary text-foreground hover:border-border-strong hover:bg-accent",
    dot: t.dot,
    header: t.text,
  };
}

export const CARD_NEON_THEMES: Record<DemandColorState, DemandCardNeonTheme> = {
  red: buildTheme("red"),
  amber: buildTheme("amber"),
  blue: buildTheme("blue"),
  purple: buildTheme("purple"),
  cyan: buildTheme("cyan"),
  green: buildTheme("green"),
  gray: buildTheme("gray"),
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
