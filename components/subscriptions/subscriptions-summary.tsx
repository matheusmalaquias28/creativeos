import type { ElementType } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  UserX,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCentsBRL } from "@/lib/format/currency";
import type { SubscriptionDelta, SubscriptionsDashboardSummary } from "@/types/subscription";

function DeltaBadge({ delta }: { delta: SubscriptionDelta }) {
  if (delta.pct === null) {
    const isNew = delta.current > 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
          isNew ? "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300" : "bg-white/5 text-muted-foreground"
        )}
      >
        {isNew ? <ArrowUpRight className="size-3" /> : <ArrowRight className="size-3" />}
        vs. mês passado
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
      {delta.pct}% <span className="opacity-70">· vs. mês passado</span>
    </span>
  );
}

function DeltaCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta: SubscriptionDelta;
  icon: ElementType;
  accent: "cyan" | "emerald";
}) {
  const ring =
    accent === "cyan"
      ? "border-cyan-500/25 dark:shadow-[0_0_24px_rgba(34,211,238,0.06)]"
      : "border-emerald-500/25 dark:shadow-[0_0_24px_rgba(52,211,153,0.06)]";
  const iconColor =
    accent === "cyan" ? "text-cyan-600 dark:text-cyan-300" : "text-emerald-600 dark:text-emerald-300";

  return (
    <div className={cn("surface-panel hover-lift flex flex-col gap-4 p-5", ring)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </p>
        <Icon className={cn("size-4 shrink-0", iconColor)} strokeWidth={1.75} />
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
        <DeltaBadge delta={delta} />
      </div>
    </div>
  );
}

function AlertStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ElementType;
}) {
  const hasAlert = value > 0;
  return (
    <div
      className={cn(
        "surface-panel flex flex-col gap-4 p-5",
        hasAlert && "border-amber-500/30 dark:shadow-[0_0_24px_rgba(251,191,36,0.06)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </p>
        <Icon
          className={cn(
            "size-4 shrink-0",
            hasAlert ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground/50"
          )}
          strokeWidth={1.75}
        />
      </div>
      <p
        className={cn(
          "text-3xl font-semibold tracking-tight tabular-nums",
          hasAlert ? "text-amber-700 dark:text-amber-300" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SubscriptionsSummary({
  summary,
}: {
  summary: SubscriptionsDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DeltaCard
        label="Assinaturas ativas"
        value={String(summary.activeCount.current)}
        delta={summary.activeCount}
        icon={CreditCard}
        accent="cyan"
      />
      <DeltaCard
        label="Valor mensal (MRR)"
        value={formatCentsBRL(summary.mrrCents.current)}
        delta={summary.mrrCents}
        icon={Wallet}
        accent="emerald"
      />
      <AlertStat
        label="Problema no pagamento"
        value={summary.paymentIssueCount}
        icon={AlertTriangle}
      />
      <AlertStat label="Sem cliente vinculado" value={summary.unlinkedCount} icon={UserX} />
    </div>
  );
}
