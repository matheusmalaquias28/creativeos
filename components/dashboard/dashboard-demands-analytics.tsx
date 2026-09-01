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
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  ImageIcon,
  Layers,
  Sparkles,
  Timer,
  TrendingUp,
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
import { cn } from "@/lib/utils";

type Props = {
  data: DashboardAnalytics;
};

type Accent = "cyan" | "violet" | "emerald" | "amber";

const STATUS_COLORS: Record<string, string> = {
  Nova: "#22d3ee",
  Fazendo: "#a78bfa",
  Revisão: "#fbbf24",
  Concluída: "#34d399",
  Cancelada: "#f87171",
  "Aguardando Definição de Data": "#94a3b8",
  "Sem status": "#64748b",
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#64748b";
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
    <div className="rounded-xl border border-cyan-500/30 bg-popover/95 p-3 shadow-[0_0_24px_rgba(34,211,238,0.15)] backdrop-blur-md">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/90">
        {label}
      </p>
      <div className="space-y-1.5 text-xs">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ background: entry.color, color: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
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
    <div className="space-y-6">
      {/* ── Delta KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeltaCard
          label="Demandas no mês"
          value={data.demandsMonth.current}
          delta={data.demandsMonth}
          accent="cyan"
          icon={Zap}
        />
        <DeltaCard
          label="Artes no mês"
          value={data.artesMonth.current}
          delta={data.artesMonth}
          accent="violet"
          icon={ImageIcon}
        />
        <DeltaCard
          label="Artes na semana"
          value={data.artesWeek.current}
          delta={data.artesWeek}
          deltaSuffix="vs. semana anterior"
          accent="emerald"
          icon={CalendarDays}
        />
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-5 shadow-[0_0_24px_rgba(52,211,153,0.08)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700/90 dark:text-emerald-300/90">
              Tempo economizado no mês
            </p>
            <TrendingUp className="size-4 shrink-0 text-emerald-600/70 dark:text-emerald-300/70" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {formatDesignerDuration(data.savedMinutesMonth)}
          </p>
          <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/60">
            {data.demandsMonth.current} demanda{data.demandsMonth.current === 1 ? "" : "s"} · fluxo híbrido vs. tradicional
          </p>
        </div>
      </div>

      {/* ── Chart + status panel ── */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-card/80 via-background to-violet-100/60 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)] dark:border-white/7 dark:to-violet-950/20 dark:shadow-[0_0_0_1px_oklch(1_0_0/6%),0_8px_40px_oklch(0_0_0/55%)] animate-in-soft">
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-violet-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                <Sparkles className="size-3" />
                Analytics · Produção
              </div>
              <h2 className="text-lg font-medium tracking-heading text-foreground">
                Demandas e artes por mês
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Volume de demandas (linha) e artes solicitadas (barras) desde o início da operação
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MiniStat label="Total demandas" value={data.totalDemands} accent="cyan" />
              <MiniStat label="Total artes" value={data.totalArtes} accent="violet" />
              <MiniStat
                label="Média artes/demanda"
                value={data.totalDemands > 0 ? (data.totalArtes / data.totalDemands).toFixed(1) : "—"}
                accent="emerald"
              />
            </div>
          </div>

          {/* Seletor de mês — produção do mês escolhido */}
          {data.months.length > 0 && selected && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Produção no mês
                </span>
                <div className="relative">
                  <select
                    value={selectedMonth || selected.month}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none rounded-lg border border-white/10 bg-[#0d1117] py-1.5 pl-3 pr-8 text-sm font-medium capitalize text-foreground transition-colors hover:border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  >
                    {[...data.months].reverse().map((m) => (
                      <option
                        key={m.month}
                        value={m.month}
                        className="bg-[#0d1117] text-foreground"
                        style={{ backgroundColor: "#0d1117", color: "#e5e7eb" }}
                      >
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums leading-none text-cyan-700 dark:text-cyan-300">
                    {selected.total_demands}
                  </p>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">
                    demandas
                  </p>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums leading-none text-violet-700 dark:text-violet-300">
                    {selected.total_artes}
                  </p>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">
                    artes
                  </p>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums leading-none text-emerald-700 dark:text-emerald-300">
                    {selected.total_demands > 0
                      ? (selected.total_artes / selected.total_demands).toFixed(1)
                      : "—"}
                  </p>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">
                    artes/demanda
                  </p>
                </div>
                {selected.avg_elapsed_minutes != null && (
                  <>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="text-right">
                      <p className="text-2xl font-semibold tabular-nums leading-none text-amber-600 dark:text-amber-300">
                        {formatDesignerDuration(selected.avg_elapsed_minutes)}
                      </p>
                      <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">
                        tempo médio
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-5">
            {/* Chart — dual Y axis fixes the scale mismatch */}
            <div className="xl:col-span-3">
              <div className="h-80 rounded-xl border border-white/5 bg-black/20 p-2">
                {chartData.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado ainda
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="artesBarFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="artesBarDim" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.1} />
                        </linearGradient>
                        <filter id="demandGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="artes"
                        tick={{ fontSize: 11, fill: "rgba(167,139,250,0.85)" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        yAxisId="demandas"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "rgba(34,211,238,0.85)" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                      <Bar
                        yAxisId="artes"
                        dataKey="Artes"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                        isAnimationActive
                        animationDuration={1200}
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
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        filter="url(#demandGlow)"
                        isAnimationActive
                        animationDuration={1400}
                        dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#22d3ee", stroke: "#67e8f9", strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  Demandas (eixo direito)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-violet-400" />
                  Artes (eixo esquerdo)
                </span>
              </div>
            </div>

            {/* Status distribution + productivity */}
            <div className="xl:col-span-2 space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Demandas por status
                </p>
                <div className="space-y-2.5">
                  {data.statusCounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem demandas</p>
                  ) : (
                    data.statusCounts.map((s) => {
                      const pct = totalStatus > 0 ? Math.round((s.count / totalStatus) * 100) : 0;
                      const color = statusColor(s.status);
                      return (
                        <div key={s.status} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-foreground/80">
                              <span
                                className="size-2 rounded-full"
                                style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
                              />
                              {s.status}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {s.count} · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}55` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <MiniPanel icon={Layers} label="Ativas" value={data.activeDemands} accent="cyan" />
                <MiniPanel icon={CheckCircle2} label="Concluídas no mês" value={data.completedThisMonth} accent="emerald" />
                <MiniPanel
                  icon={Timer}
                  label="Turnaround médio"
                  value={data.avgTurnaroundMinutes != null ? formatDesignerDuration(data.avgTurnaroundMinutes) : "—"}
                  accent="violet"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Traditional vs hybrid ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ComparisonCard
          title="Designer tradicional"
          subtitle="Produção manual completa"
          perDemand="1 hora / demanda"
          total={formatDesignerDuration(traditionalMinutesForDemands(data.totalDemands))}
          demandCount={data.totalDemands}
          accent="amber"
        />
        <ComparisonCard
          title="Designer híbrido"
          subtitle="Creative OS + IA + Spaces"
          perDemand="5 minutos / demanda"
          total={formatDesignerDuration(hybridMinutesForDemands(data.totalDemands))}
          demandCount={data.totalDemands}
          accent="cyan"
          highlight
        />
      </div>
    </div>
  );
}

function DeltaBadge({ delta, suffix }: { delta: DashboardDelta; suffix?: string }) {
  if (delta.pct === null) {
    const isNew = delta.current > 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
          isNew
            ? "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300"
            : "bg-white/5 text-muted-foreground"
        )}
      >
        {isNew ? <Sparkles className="size-3" /> : <ArrowRight className="size-3" />}
        {isNew ? "novo" : "—"}
        {suffix ? <span className="opacity-70">· {suffix}</span> : null}
      </span>
    );
  }
  const up = delta.pct > 0;
  const flat = delta.pct === 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tabular-nums",
        flat
          ? "bg-white/5 text-muted-foreground"
          : up
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/12 text-rose-600 dark:text-rose-300"
      )}
    >
      <Icon className="size-3" />
      {up ? "+" : ""}
      {delta.pct}%
      {suffix ? <span className="opacity-70">· {suffix}</span> : null}
    </span>
  );
}

function DeltaCard({
  label,
  value,
  delta,
  deltaSuffix,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number;
  delta: DashboardDelta;
  deltaSuffix?: string;
  accent: Accent;
  icon: ElementType;
}) {
  const ring: Record<Accent, string> = {
    cyan: "border-cyan-500/25 dark:shadow-[0_0_24px_rgba(34,211,238,0.06)]",
    violet: "border-violet-500/25 dark:shadow-[0_0_24px_rgba(167,139,250,0.06)]",
    emerald: "border-emerald-500/25 dark:shadow-[0_0_24px_rgba(52,211,153,0.06)]",
    amber: "border-amber-500/25 dark:shadow-[0_0_24px_rgba(251,191,36,0.06)]",
  };
  const iconColor: Record<Accent, string> = {
    cyan: "text-cyan-600 dark:text-cyan-300",
    violet: "text-violet-600 dark:text-violet-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-300",
  };
  return (
    <div className={cn("surface-panel hover-lift flex flex-col gap-4 p-5", ring[accent])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </p>
        <Icon className={cn("size-4 shrink-0", iconColor[accent])} strokeWidth={1.75} />
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
        <DeltaBadge delta={delta} suffix={deltaSuffix ?? "vs. mês passado"} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: Accent;
}) {
  const color: Record<Accent, string> = {
    cyan: "text-cyan-700 dark:text-cyan-300",
    violet: "text-violet-700 dark:text-violet-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
  };
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-center">
      <p className={cn("text-lg font-semibold tabular-nums leading-none", color[accent])}>{value}</p>
      <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground/70">{label}</p>
    </div>
  );
}

function MiniPanel({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  accent: Accent;
}) {
  const color: Record<Accent, string> = {
    cyan: "text-cyan-600 dark:text-cyan-300",
    violet: "text-violet-600 dark:text-violet-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-300",
  };
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <Icon className={cn("size-4", color[accent])} strokeWidth={1.75} />
      <p className="mt-2 text-base font-semibold tabular-nums leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[0.6rem] leading-tight text-muted-foreground/70">{label}</p>
    </div>
  );
}

function ComparisonCard({
  title,
  subtitle,
  perDemand,
  total,
  demandCount,
  accent,
  highlight = false,
}: {
  title: string;
  subtitle: string;
  perDemand: string;
  total: string;
  demandCount: number;
  accent: "amber" | "cyan";
  highlight?: boolean;
}) {
  const isAmber = accent === "amber";
  const barPercent =
    demandCount === 0
      ? 0
      : isAmber
        ? 100
        : Math.max(4, Math.round((HYBRID_DESIGNER_MINUTES / TRADITIONAL_DESIGNER_MINUTES) * 100));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 transition-premium",
        highlight
          ? "border-cyan-500/35 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]"
          : "border-amber-500/25 bg-amber-500/5"
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {isAmber ? (
            <Clock className="size-5 shrink-0 text-amber-600/70 dark:text-amber-300/70" strokeWidth={1.5} />
          ) : (
            <Sparkles className="size-5 shrink-0 text-cyan-600/70 dark:text-cyan-300/70" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tempo total</p>
            <p
              className={cn(
                "mt-1 text-3xl font-semibold tabular-nums tracking-heading",
                isAmber ? "text-amber-700 dark:text-amber-300" : "text-cyan-700 dark:text-cyan-300"
              )}
            >
              {total}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{perDemand}</p>
            <p className="mt-1 text-sm tabular-nums text-foreground">
              {demandCount} demanda{demandCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                isAmber
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                  : "bg-gradient-to-r from-violet-400 to-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
              )}
              style={{ width: `${barPercent}%` }}
            />
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            {isAmber
              ? "Baseline de referência para o mesmo volume"
              : `${Math.round(TRADITIONAL_DESIGNER_MINUTES / HYBRID_DESIGNER_MINUTES)}x menos tempo por demanda`}
          </p>
        </div>
      </div>
    </div>
  );
}
