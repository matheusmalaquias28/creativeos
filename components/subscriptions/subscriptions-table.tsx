"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCentsBRL } from "@/lib/format/currency";
import {
  SUBSCRIPTION_STATUS_LABELS,
  type ClientSubscriptionListItem,
  type SubscriptionStatus,
} from "@/types/subscription";
import {
  SubscriptionClientLinker,
  type SubscriptionClientOption,
} from "@/components/subscriptions/subscription-client-linker";
import { SubscriptionSalespersonSelect } from "@/components/subscriptions/subscription-salesperson-select";

const FILTERS: { value: SubscriptionStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "payment_issue", label: "Problema no pagamento" },
  { value: "canceled", label: "Canceladas" },
];

const STATUS_BADGE_CLASS: Record<SubscriptionStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  payment_issue: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  canceled: "border-zinc-500/25 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function monthlyAmountCents(sub: ClientSubscriptionListItem): number {
  return Math.round(sub.amount_cents / Math.max(1, sub.billing_cycle_months));
}

export function SubscriptionsTable({
  subscriptions,
  clients,
}: {
  subscriptions: ClientSubscriptionListItem[];
  clients: SubscriptionClientOption[];
}) {
  const [filter, setFilter] = useState<SubscriptionStatus | "all">("all");

  const counts = useMemo(() => {
    const map = new Map<SubscriptionStatus, number>();
    for (const sub of subscriptions) {
      map.set(sub.status, (map.get(sub.status) ?? 0) + 1);
    }
    return map;
  }, [subscriptions]);

  const filtered = useMemo(
    () => (filter === "all" ? subscriptions : subscriptions.filter((s) => s.status === filter)),
    [subscriptions, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = f.value === "all" ? subscriptions.length : (counts.get(f.value) ?? 0);
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-premium",
                active
                  ? "border-positive/40 bg-positive/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground dark:border-white/8"
              )}
            >
              {f.label}
              <span className="tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Valor mensal</th>
              <th className="px-4 py-3 text-right">LTV (pago)</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Último evento</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground/60">
                  Nenhuma assinatura nesse filtro.
                </td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b border-border/30 last:border-0 hover:bg-white/[0.015]"
                >
                  <td className="px-4 py-3">
                    <SubscriptionClientLinker
                      subscriptionId={sub.id}
                      currentClientId={sub.client_id}
                      currentClientName={sub.client_name}
                      buyerName={sub.buyer_name}
                      clientNotFound={sub.client_not_found}
                      clients={clients}
                    />
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-foreground/85">
                    {sub.product_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
                        STATUS_BADGE_CLASS[sub.status]
                      )}
                    >
                      {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground/90">
                    {formatCentsBRL(monthlyAmountCents(sub))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground/90">
                    {formatCentsBRL(sub.total_paid_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionSalespersonSelect
                      subscriptionId={sub.id}
                      currentSalesperson={sub.salesperson}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground/70">
                    {formatDate(sub.last_event_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
