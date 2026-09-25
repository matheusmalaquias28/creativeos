"use client";

import { useMemo, useState, type ElementType } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  ImageIcon,
  Layers,
  PieChart,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import type { DashboardAnalytics, DashboardDelta } from "@/types/demand";
import {
  formatDesignerDuration,
  hybridMinutesForDemands,
  traditionalMinutesForDemands,
  TRADITIONAL_DESIGNER_MINUTES,
  HYBRID_DESIGNER_MINUTES,
} from "@/lib/demands/designer-time";
import { DEMAND_TONE, getStatusColorState } from "@/lib/demands/demand-color";
import { tones, type Tone } from "@/lib/design/tokens";
import { SectionHeader } from "@/components/layout/section-header";
import { cn } from "@/lib/utils";

type Props = {
  data: DashboardAnalytics;
};

function statusTone(status: string): Tone {
  if (status === "Sem status" || status === "Cancelada") return "slate";
  return DEMAND_TONE[getStatusColorState(status)];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-border bg-popover p-3 shadow-[var(--surface-shadow-elevated)]">
      <p className="mb-2 text-xs font-bold text-foreground capitalize">{label}</p>
      <div className="space-y-1.5 text-xs">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{
                  background: entry.name === "Artes" ? tones.violet.cssVar : tones.lime.cssVar,
                }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardDemandsAnalytics({ data }: Props) {
  const chartData = useMemo(
    () =>
      data.months.map((m) => ({
        label: m.label,
        Demandas: m.total_demands,
        Artes: m.total_artes,
      })),
    [data.months]
  );

  // Seletor de mês — default no mês mais recente da série.
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => data.months.at(-1)?.month ?? ""
  );
  const selected = useMemo(
    () => data.months.find((m) => m.month === selectedMonth) ?? data.months.at(-1) ?? null,
    [data.months, selectedMonth]
  );

  const totalStatus = data.statusCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-5">
      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeltaCard
          label="Demandas no mês"
          value={data.demandsMonth.current}
          delta={data.demandsMonth}
          tone="cyan"
          icon={Zap}
        />
        <DeltaCard
          label="Artes no mês"
          value={data.artesMonth.current}
          delta={data.artesMonth}
          tone="violet"
          icon={ImageIcon}
        />
        <DeltaCard
          label="Artes na semana"
          value={data.artesWeek.current}
          delta={data.artesWeek}
          deltaSuffix="vs. semana anterior"
          tone="orange"
          icon={CalendarDays}
        />

        {/* Card de destaque — tempo economizado */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--primary)_32%,var(--card)),var(--card)_70%)] p-5 shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -bottom-14 size-44 rounded-full bg-highlight/20 blur-3xl"
          />
          <div className="relative flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-highlight text-highlight-foreground shadow-[inset_0_1px_0_oklch(1_0_0/35%)]">
              <Sparkles className="size-4" strokeWidth={2} />
            </span>
            <p className="text-[0.8125rem] font-semibold text-foreground/85">
              Tempo economizado no mês
            </p>
          </div>
          <p className="relative mt-4 text-[2rem] leading-none font-bold tracking-[-0.03em] tabular-nums text-foreground">
            {formatDesignerDuration(data.savedMinutesMonth)}
          </p>
          <p className="relative mt-2 text-xs text-muted-foreground">
            {data.demandsMonth.current} demanda{data.demandsMonth.current === 1 ? "" : "s"} · fluxo
            híbrido vs. tradicional
          </p>
        </div>
      </div>

      {/* ── Gráfico + status ── */}
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="surface-panel animate-in-soft p-5 sm:p-6 xl:col-span-2">
          <SectionHeader
            title="Produção por mês"
            description="Demandas (linha) e artes solicitadas (barras) desde o início da operação"
            icon={BarChart3}
            tone="violet"
            action={
              data.months.length > 0 && selected ? (
                <div className="relative">
                  <select
                    value={selectedMonth || selected.month}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    aria-label="Mês em destaque"
                    className="h-9 appearance-none rounded-xl border border-border bg-input py-1.5 pr-9 pl-3.5 text-[0.8125rem] font-semibold text-foreground transition-colors outline-none hover:border-border-strong focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/20 dark:[color-scheme:dark]"
                  >
                    {[...data.months].reverse().map((m) => (
                      <option key={m.month} value={m.month}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              ) : null
            }
          />

          {/* Números do mês escolhido */}
          {selected && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MonthFigure label="Demandas" value={selected.total_demands} tone="lime" />
              <MonthFigure label="Artes" value={selected.total_artes} tone="violet" />
              <MonthFigure
                label="Artes / demanda"
                value={
                  selected.total_demands > 0
                    ? (selected.total_artes / selected.total_demands).toFixed(1)
                    : "—"
                }
                tone="cyan"
              />
              <MonthFigure
                label="Tempo médio"
                value={
                  selected.avg_elapsed_minutes != null
                    ? formatDesignerDuration(selected.avg_elapsed_minutes)
                    : "—"
                }
                tone="orange"
              />
            </div>
          )}

          <div className="mt-5 h-72">
            {chartData.length === 0 ? (
              <p className="flex h-full items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-muted-foreground">
                Nenhum dado ainda
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="artesBarFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--tone-violet)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--tone-violet)" stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="artesBarDim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--tone-violet)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--tone-violet)" stopOpacity={0.12} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    yAxisId="artes"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="demandas"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--accent)", opacity: 0.5, radius: 8 }}
                  />
                  <Bar
                    yAxisId="artes"
                    dataKey="Artes"
                    radius={[8, 8, 3, 3]}
                    maxBarSize={36}
                    isAnimationActive
                    animationDuration={900}
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={
                          entry.label === selected?.label
                            ? "url(#artesBarFill)"
                            : "url(#artesBarDim)"
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="demandas"
                    type="monotone"
                    dataKey="Demandas"
                    stroke="var(--tone-lime)"
                    strokeWidth={2.5}
                    isAnimationActive
                    animationDuration={1100}
                    dot={{ r: 3, fill: "var(--card)", stroke: "var(--tone-lime)", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: "var(--tone-lime)", stroke: "var(--card)", strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-tone-lime" />
                Demandas (eixo direito)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-tone-violet" />
                Artes (eixo esquerdo)
              </span>
            </div>
            <div className="flex items-center gap-4 tabular-nums">
              <span>
                <b className="font-semibold text-foreground">{data.totalDemands}</b> demandas
              </span>
              <span>
                <b className="font-semibold text-foreground">{data.totalArtes}</b> artes
              </span>
              <span>
                <b className="font-semibold text-foreground">
                  {data.totalDemands > 0 ? (data.totalArtes / data.totalDemands).toFixed(1) : "—"}
                </b>{" "}
                artes/demanda
              </span>
            </div>
          </div>
        </section>

        {/* Status + produtividade */}
        <section className="surface-panel animate-in-soft stagger-1 flex flex-col p-5 sm:p-6">
          <SectionHeader
            title="Demandas por status"
            description={`${totalStatus} no total`}
            icon={PieChart}
            tone="cyan"
          />

          {/* Barra empilhada */}
          {totalStatus > 0 && (
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted">
              {data.statusCounts.map((s) => (
                <div
                  key={s.status}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full", tones[statusTone(s.status)].solid)}
                  style={{ width: `${(s.count / totalStatus) * 100}%` }}
                  title={`${s.status}: ${s.count}`}
                />
              ))}
            </div>
          )}

          <div className="mt-4 flex-1 space-y-1">
            {data.statusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem demandas</p>
            ) : (
              data.statusCounts.map((s) => {
                const pct = totalStatus > 0 ? Math.round((s.count / totalStatus) * 100) : 0;
                const t = tones[statusTone(s.status)];
                return (
                  <div
                    key={s.status}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors hover:bg-accent/60"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-foreground/90">
                      <span className={cn("size-2 shrink-0 rounded-full", t.dot)} />
                      <span className="truncate">{s.status}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      <b className="font-semibold text-foreground">{s.count}</b> · {pct}%
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-border pt-5">
            <MiniPanel icon={Layers} label="Ativas" value={data.activeDemands} tone="cyan" />
            <MiniPanel
              icon={CheckCircle2}
              label="Concluídas no mês"
              value={data.completedThisMonth}
              tone="green"
            />
            <MiniPanel
              icon={Timer}
              label="Turnaround"
              value={
                data.avgTurnaroundMinutes != null
                  ? formatDesignerDuration(data.avgTurnaroundMinutes)
                  : "—"
              }
              tone="violet"
            />
          </div>
        </section>
      </div>

      {/* ── Tradicional vs híbrido ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ComparisonCard
          title="Designer tradicional"
          subtitle="Produção manual completa"
          perDemand="1 hora / demanda"
          total={formatDesignerDuration(traditionalMinutesForDemands(data.totalDemands))}
          demandCount={data.totalDemands}
          variant="traditional"
        />
        <ComparisonCard
          title="Designer híbrido"
          subtitle="Creative OS + IA + Spaces"
          perDemand="5 minutos / demanda"
          total={formatDesignerDuration(hybridMinutesForDemands(data.totalDemands))}
          demandCount={data.totalDemands}
          variant="hybrid"
        />
      </div>
    </div>
  );
}

function DeltaBadge({ delta, suffix }: { delta: DashboardDelta; suffix?: string }) {
  if (delta.pct === null) {
    const isNew = delta.current > 0;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
            isNew ? tones.cyan.badge : "bg-muted text-muted-foreground"
          )}
        >
          {isNew ? <Sparkles className="size-3" /> : <ArrowRight className="size-3" />}
          {isNew ? "novo" : "—"}
        </span>
        {suffix}
      </span>
    );
  }
  const up = delta.pct > 0;
  const flat = delta.pct === 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
          flat ? "bg-muted text-muted-foreground" : up ? tones.green.badge : tones.red.badge
        )}
      >
        <Icon className="size-3" />
        {up ? "+" : ""}
        {delta.pct}%
      </span>
      {suffix}
    </span>
  );
}

function DeltaCard({
  label,
  value,
  delta,
  deltaSuffix,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  delta: DashboardDelta;
  deltaSuffix?: string;
  tone: Tone;
  icon: ElementType;
}) {
  const t = tones[tone];
  return (
    <div className="surface-panel hover-lift group relative flex flex-col gap-4 overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-[0.10] blur-2xl transition-opacity group-hover:opacity-[0.16]"
        style={{ background: t.cssVar }}
      />
      <div className="relative flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-xl", t.iconTile)}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <p className="text-[0.8125rem] font-semibold text-muted-foreground">{label}</p>
      </div>
      <div className="relative space-y-2.5">
        <p className="text-[2rem] leading-none font-bold tracking-[-0.03em] tabular-nums text-foreground">
          {value}
        </p>
        <DeltaBadge delta={delta} suffix={deltaSuffix ?? "vs. mês passado"} />
      </div>
    </div>
  );
}

function MonthFigure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", tones[tone].dot)} />
        {label}
      </p>
      <p className="mt-1.5 text-xl leading-none font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function MiniPanel({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  tone: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <Icon className={cn("size-4", tones[tone].text)} strokeWidth={2} />
      <p className="mt-2 text-base leading-none font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function ComparisonCard({
  title,
  subtitle,
  perDemand,
  total,
  demandCount,
  variant,
}: {
  title: string;
  subtitle: string;
  perDemand: string;
  total: string;
  demandCount: number;
  variant: "traditional" | "hybrid";
}) {
  const isTraditional = variant === "traditional";
  const tone: Tone = isTraditional ? "orange" : "lime";
  const t = tones[tone];
  const barPercent =
    demandCount === 0
      ? 0
      : isTraditional
        ? 100
        : Math.max(4, Math.round((HYBRID_DESIGNER_MINUTES / TRADITIONAL_DESIGNER_MINUTES) * 100));
  const Icon = isTraditional ? Clock : Sparkles;

  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden p-5",
        !isTraditional && "ring-brand"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-xl", t.iconTile)}>
            <Icon className="size-4" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {!isTraditional && (
          <span className="rounded-full bg-highlight px-2.5 py-1 text-[0.6875rem] font-bold text-highlight-foreground">
            {Math.round(TRADITIONAL_DESIGNER_MINUTES / HYBRID_DESIGNER_MINUTES)}x mais rápido
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Tempo total</p>
          <p className="mt-1 text-[1.75rem] leading-none font-bold tracking-[-0.03em] tabular-nums text-foreground">
            {total}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-muted-foreground">{perDemand}</p>
          <p className="mt-1 font-semibold tabular-nums text-foreground">
            {demandCount} demanda{demandCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", t.solid)}
          style={{ width: `${barPercent}%` }}
        />
      </div>
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">
        {isTraditional
          ? "Baseline de referência para o mesmo volume"
          : "Mesmo volume com o fluxo Creative OS"}
      </p>
    </div>
  );
}
