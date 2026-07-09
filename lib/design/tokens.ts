/**
 * Creative OS design tokens — use with Tailwind utilities or cn().
 * Source of truth for spacing/radius is globals.css (--radius, --page-padding-*).
 */

export const layout = {
  sidebarWidth: "w-[15.5rem]",
  pageX: "px-8 lg:px-10",
  pageY: "py-8 lg:py-10",
  sectionGap: "space-y-10",
} as const;

export const motion = {
  premium: "transition-premium",
  hoverLift: "hover-lift",
} as const;

/** Status color classes (maps to --positive / --negative / --warning) */
export const status = {
  positive: {
    text: "text-positive",
    bg: "bg-positive/10 dark:bg-positive/8",
    border: "border-positive/20 dark:border-positive/15",
    badge: "border-positive/20 bg-positive/10 text-positive dark:border-positive/15 dark:bg-positive/8",
  },
  negative: {
    text: "text-negative",
    bg: "bg-negative/10 dark:bg-negative/8",
    border: "border-negative/20 dark:border-negative/15",
    badge: "border-negative/20 bg-negative/10 text-negative dark:border-negative/15 dark:bg-negative/8",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning/10 dark:bg-warning/8",
    border: "border-warning/20 dark:border-warning/15",
    badge: "border-warning/20 bg-warning/10 text-warning dark:border-warning/15 dark:bg-warning/8",
  },
} as const;
