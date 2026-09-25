"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { Tone } from "@/lib/design/tokens";
import { tones } from "@/lib/design/tokens";
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

const STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  active: "green",
  payment_issue: "amber",
  canceled: "slate",
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
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl
          aria-label="Filtrar assinaturas por status"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: f.value === "all" ? subscriptions.length : (counts.get(f.value) ?? 0),
          }))}
        />
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card shadow-[var(--surface-shadow),var(--inner-highlight)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
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
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhuma assinatura nesse filtro.
                </td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-accent/50"
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
                  <td className="max-w-[180px] truncate px-4 py-3 text-foreground/90">
                    {sub.product_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_TONE[sub.status]}>
                      <span
                        className={cn("size-1.5 rounded-full", tones[STATUS_TONE[sub.status]].dot)}
                      />
                      {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
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
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
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
