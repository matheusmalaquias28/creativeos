"use client";

import dynamic from "next/dynamic";
import type { DemandMonthStat } from "@/types/demand";

const DashboardDemandsAnalytics = dynamic(
  () =>
    import("@/components/dashboard/dashboard-demands-analytics").then((mod) => ({
      default: mod.DashboardDemandsAnalytics,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[520px] animate-pulse rounded-2xl border border-cyan-500/10 bg-muted/20"
        aria-hidden
      />
    ),
  }
);

export function DashboardDemandsAnalyticsLoader({ data }: { data: DemandMonthStat[] }) {
  return <DashboardDemandsAnalytics data={data} />;
}
