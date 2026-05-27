/**
 * Creative OS design tokens — use with Tailwind utilities or cn().
 * Source of truth for spacing/radius is globals.css (--radius, --page-padding-*).
 */

export const layout = {
  sidebarWidth: "w-[15.5rem]",
  contentMax: "max-w-[1400px]",
  pageX: "px-8 lg:px-10",
  pageY: "py-8 lg:py-10",
  sectionGap: "space-y-10",
} as const;

export const motion = {
  premium: "transition-premium",
  hoverLift: "hover-lift",
} as const;
