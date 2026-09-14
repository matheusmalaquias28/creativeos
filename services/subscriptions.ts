import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type {
  ClientSubscriptionListItem,
  SubscriptionDelta,
  SubscriptionsDashboardSummary,
} from "@/types/subscription";

function throwIfDbError(error: { message: string }): never {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

const SUBSCRIPTION_SELECT =
  "id, source, external_id, client_id, client_not_found, buyer_name, buyer_email, product_name, status, hubla_status, auto_renew, payment_method, billing_cycle_months, amount_cents, currency, salesperson, activated_at, canceled_at, last_invoice_status, last_invoice_due_date, last_event_at, created_at, updated_at, clients(name, slug)";

function mapRow(
  row: Record<string, unknown>,
  totalPaidCents: number
): ClientSubscriptionListItem {
  const clients = row.clients as
    | { name?: string; slug?: string }
    | { name?: string; slug?: string }[]
    | null;
  const client = Array.isArray(clients) ? clients[0] : clients;

  return {
    id: String(row.id),
    source: String(row.source),
    external_id: String(row.external_id),
    client_id: row.client_id ? String(row.client_id) : null,
    client_not_found: Boolean(row.client_not_found),
    buyer_name: String(row.buyer_name ?? ""),
    buyer_email: String(row.buyer_email ?? ""),
    product_name: row.product_name ? String(row.product_name) : null,
    status: row.status as ClientSubscriptionListItem["status"],
    hubla_status: row.hubla_status ? String(row.hubla_status) : null,
    auto_renew: Boolean(row.auto_renew),
    payment_method: row.payment_method ? String(row.payment_method) : null,
    billing_cycle_months: Number(row.billing_cycle_months ?? 1),
    amount_cents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "BRL"),
    salesperson: (row.salesperson as ClientSubscriptionListItem["salesperson"]) ?? null,
    activated_at: row.activated_at ? String(row.activated_at) : null,
    canceled_at: row.canceled_at ? String(row.canceled_at) : null,
    last_invoice_status: row.last_invoice_status ? String(row.last_invoice_status) : null,
    last_invoice_due_date: row.last_invoice_due_date
      ? String(row.last_invoice_due_date)
      : null,
    last_event_at: row.last_event_at ? String(row.last_event_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    client_name: client?.name ?? null,
    client_slug: client?.slug ?? null,
    total_paid_cents: totalPaidCents,
  };
}

export const getSubscriptionsForUser = cache(
  async (): Promise<ClientSubscriptionListItem[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("client_subscriptions")
      .select(SUBSCRIPTION_SELECT)
      .order("created_at", { ascending: false });

    if (error) throwIfDbError(error);
    const rows = data ?? [];
    if (rows.length === 0) return [];

    // LTV é uma soma sobre os pagamentos confirmados, não uma coluna — evita
    // dobrar em reentregas de webhook. Ver client_subscription_payments.
    const { data: payments, error: paymentsError } = await supabase
      .from("client_subscription_payments")
      .select("subscription_id, amount_cents");

    if (paymentsError) throwIfDbError(paymentsError);

    const totalsBySubscription = new Map<string, number>();
    for (const payment of payments ?? []) {
      const key = String(payment.subscription_id);
      totalsBySubscription.set(
        key,
        (totalsBySubscription.get(key) ?? 0) + Number(payment.amount_cents)
      );
    }

    return rows.map((row) => {
      const record = row as Record<string, unknown>;
      return mapRow(record, totalsBySubscription.get(String(record.id)) ?? 0);
    });
  }
);

function delta(current: number, previous: number): SubscriptionDelta {
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, pct };
}

/**
 * Resumo do topo da página: assinaturas ativas e MRR, comparados com o fim do
 * mês passado. Não temos um histórico de status (só `activated_at`/
 * `canceled_at`), então a base de comparação é aproximada: "ativa" e
 * "com problema de pagamento" contam juntas como uma assinatura em cobrança
 * (não cancelada) — é a única leitura que dá pra reconstruir no passado sem
 * guardar snapshots. Problema de pagamento aparece à parte, como alerta.
 */
export const getSubscriptionsDashboardSummary = cache(
  async (): Promise<SubscriptionsDashboardSummary> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("client_subscriptions")
      .select(
        "status, amount_cents, billing_cycle_months, activated_at, canceled_at, client_not_found"
      );

    if (error) throwIfDbError(error);
    const rows = data ?? [];

    const now = new Date();
    // Início do mês atual == fim do mês passado, para o comparativo.
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    let activeNow = 0;
    let activeLastMonthEnd = 0;
    let mrrNow = 0;
    let mrrLastMonthEnd = 0;
    let paymentIssueCount = 0;
    let canceledThisMonth = 0;
    let unlinkedCount = 0;

    for (const row of rows) {
      const status = row.status;
      const billingCycleMonths = Math.max(1, Number(row.billing_cycle_months ?? 1));
      const monthlyAmount = Math.round(Number(row.amount_cents ?? 0) / billingCycleMonths);
      const activatedAt = row.activated_at ? new Date(row.activated_at) : null;
      const canceledAt = row.canceled_at ? new Date(row.canceled_at) : null;
      const isBilling = status === "active" || status === "payment_issue";

      if (isBilling) {
        activeNow += 1;
        mrrNow += monthlyAmount;
      }
      if (status === "payment_issue") paymentIssueCount += 1;
      if (row.client_not_found) unlinkedCount += 1;

      const activeByLastMonthEnd = activatedAt ? activatedAt < lastMonthEnd : false;
      const canceledByLastMonthEnd = canceledAt ? canceledAt < lastMonthEnd : false;
      if (activeByLastMonthEnd && !canceledByLastMonthEnd) {
        activeLastMonthEnd += 1;
        mrrLastMonthEnd += monthlyAmount;
      }

      if (canceledAt && canceledAt >= lastMonthEnd) canceledThisMonth += 1;
    }

    return {
      activeCount: delta(activeNow, activeLastMonthEnd),
      mrrCents: delta(mrrNow, mrrLastMonthEnd),
      paymentIssueCount,
      canceledThisMonth,
      unlinkedCount,
    };
  }
);
