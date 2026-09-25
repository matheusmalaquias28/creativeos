/**
 * Creative OS design tokens (V2 "Midnight") — use com utilitários Tailwind ou cn().
 * Fonte de verdade das cores/raios é app/globals.css. Ver DESIGN.md.
 */

export const layout = {
  sidebarWidth: "w-[16.5rem]",
  pageX: "px-4 sm:px-6 lg:px-8 xl:px-10",
  pageY: "py-6 lg:py-8",
  sectionGap: "space-y-8",
  /** Largura máxima de leitura confortável para páginas de conteúdo. */
  maxWidth: "mx-auto w-full max-w-[1600px]",
} as const;

export const motion = {
  premium: "transition-premium",
  hoverLift: "hover-lift",
} as const;

/**
 * Tons categóricos. Cada tom tem as mesmas "peças" para que status, badges,
 * colunas de kanban, ícones e gráficos usem exatamente a mesma linguagem.
 * As classes são literais para o scanner do Tailwind enxergá-las.
 */
export type Tone =
  | "violet"
  | "lime"
  | "cyan"
  | "blue"
  | "orange"
  | "pink"
  | "amber"
  | "green"
  | "red"
  | "slate";

export type ToneStyle = {
  /** Texto na cor do tom. */
  text: string;
  /** Fundo translúcido suave (chips, ícones, linhas destacadas). */
  soft: string;
  /** Borda suave. */
  border: string;
  /** Fundo sólido (pontos, barras, contadores). */
  solid: string;
  /** Pílula completa: borda + fundo suave + texto. */
  badge: string;
  /** Ponto de status. */
  dot: string;
  /** Tile de ícone (quadrado arredondado com fundo suave). */
  iconTile: string;
  /** Barra de acento à esquerda/topo. */
  bar: string;
  /** Valor CSS para uso em estilos inline / gráficos. */
  cssVar: string;
};

export const tones: Record<Tone, ToneStyle> = {
  violet: {
    text: "text-tone-violet",
    soft: "bg-tone-violet/12",
    border: "border-tone-violet/25",
    solid: "bg-tone-violet",
    badge: "border-tone-violet/25 bg-tone-violet/12 text-tone-violet",
    dot: "bg-tone-violet",
    iconTile: "bg-tone-violet/14 text-tone-violet ring-1 ring-inset ring-tone-violet/20",
    bar: "bg-tone-violet",
    cssVar: "var(--tone-violet)",
  },
  lime: {
    text: "text-tone-lime",
    soft: "bg-tone-lime/12",
    border: "border-tone-lime/25",
    solid: "bg-tone-lime",
    badge: "border-tone-lime/25 bg-tone-lime/12 text-tone-lime",
    dot: "bg-tone-lime",
    iconTile: "bg-tone-lime/14 text-tone-lime ring-1 ring-inset ring-tone-lime/20",
    bar: "bg-tone-lime",
    cssVar: "var(--tone-lime)",
  },
  cyan: {
    text: "text-tone-cyan",
    soft: "bg-tone-cyan/12",
    border: "border-tone-cyan/25",
    solid: "bg-tone-cyan",
    badge: "border-tone-cyan/25 bg-tone-cyan/12 text-tone-cyan",
    dot: "bg-tone-cyan",
    iconTile: "bg-tone-cyan/14 text-tone-cyan ring-1 ring-inset ring-tone-cyan/20",
    bar: "bg-tone-cyan",
    cssVar: "var(--tone-cyan)",
  },
  blue: {
    text: "text-tone-blue",
    soft: "bg-tone-blue/12",
    border: "border-tone-blue/25",
    solid: "bg-tone-blue",
    badge: "border-tone-blue/25 bg-tone-blue/12 text-tone-blue",
    dot: "bg-tone-blue",
    iconTile: "bg-tone-blue/14 text-tone-blue ring-1 ring-inset ring-tone-blue/20",
    bar: "bg-tone-blue",
    cssVar: "var(--tone-blue)",
  },
  orange: {
    text: "text-tone-orange",
    soft: "bg-tone-orange/12",
    border: "border-tone-orange/25",
    solid: "bg-tone-orange",
    badge: "border-tone-orange/25 bg-tone-orange/12 text-tone-orange",
    dot: "bg-tone-orange",
    iconTile: "bg-tone-orange/14 text-tone-orange ring-1 ring-inset ring-tone-orange/20",
    bar: "bg-tone-orange",
    cssVar: "var(--tone-orange)",
  },
  pink: {
    text: "text-tone-pink",
    soft: "bg-tone-pink/12",
    border: "border-tone-pink/25",
    solid: "bg-tone-pink",
    badge: "border-tone-pink/25 bg-tone-pink/12 text-tone-pink",
    dot: "bg-tone-pink",
    iconTile: "bg-tone-pink/14 text-tone-pink ring-1 ring-inset ring-tone-pink/20",
    bar: "bg-tone-pink",
    cssVar: "var(--tone-pink)",
  },
  amber: {
    text: "text-tone-amber",
    soft: "bg-tone-amber/12",
    border: "border-tone-amber/25",
    solid: "bg-tone-amber",
    badge: "border-tone-amber/25 bg-tone-amber/12 text-tone-amber",
    dot: "bg-tone-amber",
    iconTile: "bg-tone-amber/14 text-tone-amber ring-1 ring-inset ring-tone-amber/20",
    bar: "bg-tone-amber",
    cssVar: "var(--tone-amber)",
  },
  green: {
    text: "text-tone-green",
    soft: "bg-tone-green/12",
    border: "border-tone-green/25",
    solid: "bg-tone-green",
    badge: "border-tone-green/25 bg-tone-green/12 text-tone-green",
    dot: "bg-tone-green",
    iconTile: "bg-tone-green/14 text-tone-green ring-1 ring-inset ring-tone-green/20",
    bar: "bg-tone-green",
    cssVar: "var(--tone-green)",
  },
  red: {
    text: "text-tone-red",
    soft: "bg-tone-red/12",
    border: "border-tone-red/25",
    solid: "bg-tone-red",
    badge: "border-tone-red/25 bg-tone-red/12 text-tone-red",
    dot: "bg-tone-red",
    iconTile: "bg-tone-red/14 text-tone-red ring-1 ring-inset ring-tone-red/20",
    bar: "bg-tone-red",
    cssVar: "var(--tone-red)",
  },
  slate: {
    text: "text-tone-slate",
    soft: "bg-tone-slate/12",
    border: "border-tone-slate/25",
    solid: "bg-tone-slate",
    badge: "border-tone-slate/25 bg-tone-slate/12 text-tone-slate",
    dot: "bg-tone-slate",
    iconTile: "bg-tone-slate/14 text-tone-slate ring-1 ring-inset ring-tone-slate/20",
    bar: "bg-tone-slate",
    cssVar: "var(--tone-slate)",
  },
};

/** Status semânticos → tons (legado: positive/negative/warning). */
export const status = {
  positive: {
    text: tones.green.text,
    bg: tones.green.soft,
    border: tones.green.border,
    badge: tones.green.badge,
  },
  negative: {
    text: tones.red.text,
    bg: tones.red.soft,
    border: tones.red.border,
    badge: tones.red.badge,
  },
  warning: {
    text: tones.amber.text,
    bg: tones.amber.soft,
    border: tones.amber.border,
    badge: tones.amber.badge,
  },
} as const;
