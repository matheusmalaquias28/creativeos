/**
 * Status normalizado da assinatura no CreativeOS — derivado dos campos brutos da
 * Hubla (hubla_status, auto_renew, last_invoice_status). Ver lib/subscriptions/status.ts.
 */
export const SUBSCRIPTION_STATUSES = ["active", "payment_issue", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  payment_issue: "Problema no pagamento",
  canceled: "Cancelada",
};

/** Vendedor responsável pela assinatura — lista fixa por enquanto. */
export const SALESPERSON_OPTIONS = [
  { value: "matheus", label: "Eu" },
  { value: "paulo_junior", label: "Paulo Junior" },
] as const;
export type Salesperson = (typeof SALESPERSON_OPTIONS)[number]["value"];

export type ClientSubscription = {
  id: string;
  source: string;
  external_id: string;
  client_id: string | null;
  client_not_found: boolean;
  buyer_name: string;
  buyer_email: string;
  product_name: string | null;
  status: SubscriptionStatus;
  hubla_status: string | null;
  auto_renew: boolean;
  payment_method: string | null;
  billing_cycle_months: number;
  amount_cents: number;
  currency: string;
  salesperson: Salesperson | null;
  activated_at: string | null;
  canceled_at: string | null;
  last_invoice_status: string | null;
  last_invoice_due_date: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientSubscriptionListItem = ClientSubscription & {
  client_name?: string | null;
  client_slug?: string | null;
  /** Soma das faturas pagas (client_subscription_payments) — o LTV até agora. */
  total_paid_cents: number;
};

/** current/previous/pct — mesmo formato usado no dashboard de demandas. */
export type SubscriptionDelta = {
  current: number;
  previous: number;
  pct: number | null;
};

export type SubscriptionsDashboardSummary = {
  activeCount: SubscriptionDelta;
  mrrCents: SubscriptionDelta;
  paymentIssueCount: number;
  canceledThisMonth: number;
  unlinkedCount: number;
};
