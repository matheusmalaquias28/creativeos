"use client";

import dynamic from "next/dynamic";
import type { DashboardAnalytics } from "@/types/demand";

const DashboardDemandsAnalytics = dynamic(
  () =>
    import("@/components/dashboard/dashboard-demands-analytics").then((mod) => ({
      default: mod.DashboardDemandsAnalytics,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-5" aria-hidden>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[9.5rem] animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="h-[31rem] animate-pulse rounded-2xl border border-border bg-card xl:col-span-2" />
          <div className="h-[31rem] animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </div>
    ),
  }
);

export function DashboardDemandsAnalyticsLoader({ data }: { data: DashboardAnalytics }) {
  return <DashboardDemandsAnalytics data={data} />;
}
