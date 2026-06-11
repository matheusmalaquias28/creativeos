"use client";

import dynamic from "next/dynamic";
import type { DemandMonthStat } from "@/types/demand";

const DemandsMonthlyChart = dynamic(
  () =>
    import("@/components/demands/demands-monthly-chart").then((mod) => ({
      default: mod.DemandsMonthlyChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-64 animate-pulse rounded-xl bg-muted/30"
        aria-hidden
      />
    ),
  }
);

export function DemandsMonthlyChartLoader({ data }: { data: DemandMonthStat[] }) {
  return <DemandsMonthlyChart data={data} />;
}
