"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Legend,
} from "recharts";
import type { DemandMonthStat } from "@/types/demand";

type Props = {
  data: DemandMonthStat[];
};

type FilterKey = "all" | string;

function CustomTooltip({
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
    <div className="rounded-xl border border-border/60 bg-popover p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.name === "Tempo médio (min)"
              ? `${entry.value} min`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DemandsMonthlyChart({ data }: Props) {
  const months = Array.from(new Set(data.map((d) => d.month))).sort();
  const [selectedMonth, setSelectedMonth] = useState<FilterKey>("all");

  const displayed =
    selectedMonth === "all"
      ? data
      : data.filter((d) => d.month === selectedMonth);

  const totalDemands = displayed.reduce((a, d) => a + d.total_demands, 0);
  const totalArtes = displayed.reduce((a, d) => a + d.total_artes, 0);
  const avgMinutes =
    displayed.filter((d) => d.avg_elapsed_minutes != null).length > 0
      ? Math.round(
          displayed
            .filter((d) => d.avg_elapsed_minutes != null)
            .reduce((a, d) => a + (d.avg_elapsed_minutes ?? 0), 0) /
            displayed.filter((d) => d.avg_elapsed_minutes != null).length
        )
      : null;

  const chartData = displayed.map((d) => ({
    label: d.label,
    Demandas: d.total_demands,
    Artes: d.total_artes,
    "Tempo médio (min)": d.avg_elapsed_minutes ?? 0,
  }));

  return (
    <div className="space-y-4">
      {/* Filtro por mês */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedMonth("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selectedMonth === "all"
              ? "border-foreground/30 bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          }`}
        >
          Todos os meses
        </button>
        {months.map((month) => {
          const stat = data.find((d) => d.month === month);
          return (
            <button
              key={month}
              type="button"
              onClick={() =>
                setSelectedMonth(month === selectedMonth ? "all" : month)
              }
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedMonth === month
                  ? "border-foreground/30 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {stat?.label ?? month}
            </button>
          );
        })}
      </div>

      {/* Sumário */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Demandas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalDemands}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Artes</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalArtes}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Tempo médio</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {avgMinutes != null ? `${avgMinutes}min` : "—"}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum dado no período
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barGap={4}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border/40"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
              />
              <YAxis
                yAxisId="count"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <YAxis
                yAxisId="time"
                orientation="right"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
                unit="m"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              <Bar
                yAxisId="count"
                dataKey="Demandas"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="count"
                dataKey="Artes"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="time"
                type="monotone"
                dataKey="Tempo médio (min)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
