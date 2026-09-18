import type { SubscriptionStatus } from "@/types/subscription";

/** Status de fatura da Hubla que indicam problema de cobrança em aberto. */
const PROBLEM_INVOICE_STATUSES = new Set([
  "overdue",
  "unpaid",
  "disputed",
  "chargeback",
]);

/**
 * Deriva o status normalizado (active/payment_issue/canceled) a partir dos
 * campos brutos da Hubla. A Hubla não expõe um status único de "cancelada":
 * `subscription.status` vira "inactive" quando os créditos acabam, e o
 * auto-renew desligado (`renewal_disabled`) é como o cliente sinaliza que não
 * quer renovar — tratamos os dois como cancelamento. Problema de pagamento só
 * é sinalizado quando a assinatura ainda está tecnicamente ativa.
 */
export function deriveSubscriptionStatus(params: {
  hublaStatus: string | null;
  autoRenew: boolean;
  lastInvoiceStatus: string | null;
}): SubscriptionStatus {
  const { hublaStatus, autoRenew, lastInvoiceStatus } = params;

  if (hublaStatus === "inactive" || autoRenew === false) return "canceled";

  if (lastInvoiceStatus && PROBLEM_INVOICE_STATUSES.has(lastInvoiceStatus)) {
    return "payment_issue";
  }

  return "active";
}
