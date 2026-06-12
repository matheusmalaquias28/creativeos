"use client";

import { useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, ImageIcon, Layers, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { DemandMonthStat } from "@/types/demand";
import {
  formatDesignerDuration,
  hybridMinutesForDemands,
  traditionalMinutesForDemands,
  TRADITIONAL_DESIGNER_MINUTES,
  HYBRID_DESIGNER_MINUTES,
} from "@/lib/demands/designer-time";
import { cn } from "@/lib/utils";

type Props = {
  data: DemandMonthStat[];
};

type FilterKey = "all" | string;

function fillLast12Months(data: DemandMonthStat[]): DemandMonthStat[] {
  const map = new Map(data.map((item) => [item.month, item]));
  const months: DemandMonthStat[] = [];
  const now = new Date();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push(
      map.get(month) ?? {
        month,
        label: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        total_demands: 0,
        total_artes: 0,
        avg_elapsed_minutes: null,
      }
    );
  }

  return months;
}

function NeonTooltip({
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/90">
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
  const filled = useMemo(() => fillLast12Months(data), [data]);
  const months = useMemo(
    () =>
      filled
        .filter((item) => item.total_demands > 0 || item.total_artes > 0)
        .map((item) => item.month),
    [filled]
  );
  const [selectedMonth, setSelectedMonth] = useState<FilterKey>("all");

  const displayed = useMemo(
    () =>
      selectedMonth === "all"
        ? filled
        : filled.filter((item) => item.month === selectedMonth),
    [filled, selectedMonth]
  );

  const chartData = useMemo(
    () =>
      displayed.map((item) => ({
        label: item.label,
        Demandas: item.total_demands,
        Artes: item.total_artes,
        Tradicional: Number((traditionalMinutesForDemands(item.total_demands) / 60).toFixed(1)),
        Híbrido: Number((hybridMinutesForDemands(item.total_demands) / 60).toFixed(2)),
      })),
    [displayed]
  );

  const totals = useMemo(() => {
    const demandCount = displayed.reduce((sum, item) => sum + item.total_demands, 0);
    const artesCount = displayed.reduce((sum, item) => sum + item.total_artes, 0);
    const traditionalMinutes = traditionalMinutesForDemands(demandCount);
    const hybridMinutes = hybridMinutesForDemands(demandCount);
    const savedMinutes = Math.max(traditionalMinutes - hybridMinutes, 0);
    const speedup =
      hybridMinutes > 0
        ? Math.round(traditionalMinutes / hybridMinutes)
        : TRADITIONAL_DESIGNER_MINUTES / HYBRID_DESIGNER_MINUTES;

    return { demandCount, artesCount, traditionalMinutes, hybridMinutes, savedMinutes, speedup };
  }, [displayed]);

  const filterLabel =
    selectedMonth === "all"
      ? "Últimos 12 meses"
      : (filled.find((item) => item.month === selectedMonth)?.label ?? selectedMonth);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-card/80 via-background to-violet-950/20 p-6 shadow-[0_0_60px_rgba(34,211,238,0.08)] animate-in-soft">
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-cyan-300">
              <Sparkles className="size-3" />
              Analytics · Demandas
            </div>
            <h2 className="text-lg font-medium tracking-heading text-foreground">
              Demandas e artes geradas
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Volume filtrável por mês e comparativo de tempo entre designer tradicional e híbrido
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.12)]">
            <TrendingUp className="size-4" />
            <span className="font-medium tabular-nums">{totals.speedup}x</span>
            <span className="text-emerald-300/80">mais rápido</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPill
            active={selectedMonth === "all"}
            onClick={() => setSelectedMonth("all")}
          >
            Todos os meses
          </FilterPill>
          {months.map((month) => {
            const stat = filled.find((item) => item.month === month);
            return (
              <FilterPill
                key={month}
                active={selectedMonth === month}
                onClick={() => setSelectedMonth(month === selectedMonth ? "all" : month)}
              >
                {stat?.label ?? month}
              </FilterPill>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Demandas"
            value={String(totals.demandCount)}
            hint={filterLabel}
            accent="cyan"
            icon={Zap}
            large
          />
          <KpiCard
            label="Artes"
            value={String(totals.artesCount)}
            hint={filterLabel}
            accent="violet"
            icon={ImageIcon}
            large
          />
          <KpiCard
            label="Média artes / demanda"
            value={
              totals.demandCount > 0
                ? (totals.artesCount / totals.demandCount).toFixed(1)
                : "—"
            }
            hint={filterLabel}
            accent="emerald"
            icon={Layers}
            large
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Designer tradicional"
            value={formatDesignerDuration(totals.traditionalMinutes)}
            hint="1h por demanda"
            accent="amber"
            icon={Clock}
          />
          <KpiCard
            label="Designer híbrido"
            value={formatDesignerDuration(totals.hybridMinutes)}
            hint="5 min por demanda"
            accent="violet"
            icon={Sparkles}
          />
          <KpiCard
            label="Tempo economizado"
            value={formatDesignerDuration(totals.savedMinutes)}
            hint="vs. fluxo tradicional"
            accent="emerald"
            icon={TrendingUp}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demandas e artes por mês
            </p>
            <div className="h-72 rounded-xl border border-white/5 bg-black/20 p-2">
              {chartData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado no período
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="demandNeonFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="artesNeonFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                      <filter id="demandNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="rgba(148,163,184,0.12)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<NeonTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Demandas"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      fill="url(#demandNeonFill)"
                      filter="url(#demandNeonGlow)"
                      isAnimationActive
                      animationDuration={1400}
                      dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
                      activeDot={{
                        r: 6,
                        fill: "#22d3ee",
                        stroke: "#67e8f9",
                        strokeWidth: 2,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Artes"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      fill="url(#artesNeonFill)"
                      isAnimationActive
                      animationDuration={1600}
                      dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                      activeDot={{
                        r: 5,
                        fill: "#a78bfa",
                        stroke: "#c4b5fd",
                        strokeWidth: 2,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tempo total (horas)
            </p>
            <div className="h-72 rounded-xl border border-white/5 bg-black/20 p-2">
              {chartData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado no período
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    barGap={6}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="traditionalBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="hybridBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="rgba(148,163,184,0.12)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }}
                      axisLine={false}
                      tickLine={false}
                      unit="h"
                    />
                    <Tooltip content={<NeonTooltip />} />
                    <Bar
                      dataKey="Tradicional"
                      fill="url(#traditionalBar)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={22}
                      isAnimationActive
                      animationDuration={1200}
                    />
                    <Bar
                      dataKey="Híbrido"
                      fill="url(#hybridBar)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={22}
                      isAnimationActive
                      animationDuration={1400}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ComparisonCard
            title="Designer tradicional"
            subtitle="Produção manual completa"
            perDemand="1 hora / demanda"
            total={formatDesignerDuration(totals.traditionalMinutes)}
            demandCount={totals.demandCount}
            accent="amber"
          />
          <ComparisonCard
            title="Designer híbrido"
            subtitle="Creative OS + IA + Spaces"
            perDemand="5 minutos / demanda"
            total={formatDesignerDuration(totals.hybridMinutes)}
            demandCount={totals.demandCount}
            accent="cyan"
            highlight
          />
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-premium",
        active
          ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]"
          : "border-border/50 text-muted-foreground hover:border-cyan-500/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  large = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "cyan" | "amber" | "violet" | "emerald";
  icon: ElementType;
  large?: boolean;
}) {
  const accents = {
    cyan: "border-cyan-500/25 bg-cyan-500/5 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.08)]",
    amber: "border-amber-500/25 bg-amber-500/5 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.08)]",
    violet: "border-violet-500/25 bg-violet-500/5 text-violet-300 shadow-[0_0_20px_rgba(167,139,250,0.08)]",
    emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.08)]",
  };

  return (
    <div className={cn("rounded-xl border px-4 py-4 transition-premium", accents[accent])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-medium uppercase tracking-wide opacity-80">{label}</p>
        <Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.5} />
      </div>
      <p
        className={cn(
          "mt-2 font-semibold tabular-nums tracking-heading text-foreground",
          large ? "text-3xl" : "text-2xl"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
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
        <div>
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tempo total</p>
            <p
              className={cn(
                "mt-1 text-3xl font-semibold tabular-nums tracking-heading",
                isAmber ? "text-amber-300" : "text-cyan-300"
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
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
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
