# Creative OS — Design System

Dark-first premium SaaS aesthetic (Linear / Vercel / Raycast lineage).

## Typography

- **Primary:** Manrope (400, 500, 600)
- **Mono:** Geist Mono (slugs, technical labels)
- Headings: `tracking-heading` (-0.03em), medium weight
- Display: `text-display` for marketing hero

## Color

OKLCH tinted neutrals (cool graphite ~265° hue). No pure black/white.
Accent usage ≤10% — borders and muted UI only.

| Token | Role |
|-------|------|
| `--background` | Deep base |
| `--card` / `--surface` | Layered translucent panels |
| `--border` | Low-contrast separators (~35% opacity) |
| `--primary` | Soft near-white for primary actions |
| `--muted-foreground` | Secondary text |

## Spacing & radius

- Page padding: `px-8 lg:px-10`, `py-8 lg:py-10`
- Section gap: `space-y-10` (`layout.sectionGap`)
- Radius base: `0.5rem` — rounded but restrained

## Components

- **Surface** — primary panel primitive (default / elevated / ghost / dashed)
- **Card** — shadcn card aligned to surface tokens
- **AmbientBackground** — cinematic gradients + noise

## Motion

- `transition-premium` — 220ms, ease `[0.22, 1, 0.36, 1]`
- `animate-in-soft` — subtle fade + 6px translate
- Hover: border shift, no heavy shadows

## Anti-patterns

- Saturated gradients, neon glows, thick borders
- Glassmorphism excess, neumorphism, template dashboards
