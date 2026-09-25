# Creative OS — Design System V2 "Midnight"

Dark-first, com camadas de profundidade e uma paleta de marca viva
(violeta + lime) apoiada por tons categóricos. Referências: dashboards de
fintech/cripto (Coinholder, Stakent) e o bento claro do QuickBooks.

> Regra de ouro: **componentes nunca usam cores cruas do Tailwind**
> (`emerald-500`, `cyan-300`, `white/5`, `black/20`, `#22d3ee`…).
> Use tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`)
> ou tons (`text-tone-violet`, `tones.cyan.badge`). Assim o tema claro/escuro
> e futuras mudanças de marca funcionam em todo o app de uma vez.

## Camadas (do fundo para frente)

| Token | Uso |
|-------|-----|
| `bg-background` | Fundo da página |
| `bg-sidebar` / `bg-surface` | Sidebar; áreas rebaixadas (colunas de kanban, wells, inputs agrupados) |
| `bg-card` | Painéis e cards (padrão) |
| `bg-surface-elevated` / `bg-popover` | Elementos flutuantes, dialogs, menus |
| `bg-accent` | Hover de itens (listas, menus, botões ghost) |
| `bg-muted` | Trilhos de progresso, skeletons, chips neutros |

Bordas: `border-border` (padrão) e `border-border-strong` (hover / tracejado).
Sombras: `shadow-[var(--surface-shadow)]`, `--surface-shadow-elevated`,
`--surface-shadow-hover`, e `--inner-highlight` (brilho de 1px no topo).

## Marca

| Token | Uso |
|-------|-----|
| `primary` (violeta) | Ação principal, item ativo da navegação, foco, links |
| `highlight` (lime) | CTA de destaque pontual, contadores de "novo", badges de ganho |
| `.ring-brand` | Borda gradiente violeta → lime para 1 card de destaque por tela |

Use `highlight` com parcimônia (≤ 1–2 elementos por tela).

## Tons categóricos

`violet · lime · cyan · blue · orange · pink · amber · green · red · slate`

Utilitários Tailwind: `text-tone-*`, `bg-tone-*/12`, `border-tone-*/25`.
Em TS, prefira o mapa pronto em `lib/design/tokens.ts`:

```ts
import { tones } from "@/lib/design/tokens";
tones.cyan.badge    // chip: borda + fundo suave + texto
tones.cyan.iconTile // tile de ícone
tones.cyan.dot      // ponto de status
tones.cyan.solid    // barra/fundo sólido
tones.cyan.text / .soft / .border / .bar / .cssVar
```

Semântica recomendada:

| Significado | Tom |
|-------------|-----|
| Sucesso, concluído, aprovado | `green` |
| Erro, atrasado, destrutivo | `red` |
| Atenção, pendente, sem data | `amber` |
| Em andamento | `blue` |
| Revisão / aprovação | `violet` |
| Novo / na fila / info | `cyan` |
| Cancelado / arquivado / neutro | `slate` |
| Criação, IA, geração | `pink` ou `violet` |

Status de demandas: `DEMAND_TONE` e `CARD_NEON_THEMES` em
`lib/demands/demand-color.ts` (já mapeados para tons).
Gráficos (recharts): use `var(--tone-*)`, `var(--border)`,
`var(--muted-foreground)` direto em `fill`/`stroke`.

## Tipografia

- **Manrope** (400–800). Títulos em `font-bold`, `tracking-tight`.
- Título de página: via `PageHeader` (≈30px bold).
- Título de seção: `SectionHeader` (16px bold + ícone em tile colorido).
- Rótulos: sentence case, `text-[0.8125rem] font-semibold`. Evite
  UPPERCASE com tracking largo, exceto em micro-rótulos de tabela.
- Números: `tabular-nums`, `font-bold`, `tracking-[-0.03em]`.
- **Geist Mono** apenas para slugs/IDs técnicos.

## Raio e espaçamento

- `--radius: 0.875rem` → cards `rounded-2xl`, controles `rounded-xl`,
  chips `rounded-full`/`rounded-md`.
- Página: `layout.pageX` / `layout.pageY`; seções: `layout.sectionGap`
  (`space-y-8`); grids de cards: `gap-4`/`gap-5`.

## Componentes base

| Componente | Onde |
|------------|------|
| `DashboardPage` | Toda página do dashboard. Props: `title`, `description`, `eyebrow`, `headerAction`, `headerContent`, `backHref` |
| `SectionHeader` | Título de seção com ícone/tons e ação |
| `Surface` | Painel: `default`, `elevated`, `inset`, `dashed`, `ghost`, `brand` |
| `StatCard` | KPI com tile colorido (`tone`) |
| `EmptyState` | Estados vazios (ícone + título + descrição + ação) |
| `SegmentedControl` | Alternadores (Ativas/Arquivadas), por link ou estado |
| `Badge` | Variantes semânticas + uma por tom (`variant="cyan"`) |
| `Button` | `default` (violeta), `highlight` (lime), `outline`, `secondary`, `ghost`, `destructive`, `positive` |
| `Dialog` / `Sheet` | Formulários e fluxos secundários — não deixe formulários sempre abertos na página |
| Command menu | `⌘K`/`Ctrl K` — rotas vêm de `components/layout/nav-config.ts` |

Navegação: adicione novas áreas **só** em `NAV_SECTIONS`
(`components/layout/nav-config.ts`); sidebar, menu mobile e ⌘K se atualizam.

## Movimento

- `transition-premium` (200ms, `ease-premium`), `hover-lift` para cards
  clicáveis (sobe 1px + sombra).
- `animate-in-soft` + `stagger-1..4` para entrada de grids.

## Anti-padrões (V1 → removidos)

- Brilhos neon (`shadow-[0_0_24px_rgba(...)]`), orbs com blur em cards.
- Gradientes saturados como fundo de card; glassmorphism/backdrop-blur em painéis.
- Preto puro e cinzas sem matiz; `white/x` e `black/x` para superfícies.
- Formulários de criação fixos no topo das listagens.
