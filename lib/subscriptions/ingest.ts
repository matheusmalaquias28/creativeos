import type { createAdminClient } from "@/lib/supabase/admin";
import { findClientByExternalName } from "@/lib/demands/match-client";
import { deriveSubscriptionStatus } from "@/lib/subscriptions/status";
import type { ParsedHublaEvent } from "@/lib/subscriptions/parse-hubla-payload";
import type { Json } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

export type IngestResult =
  | { ok: true; subscriptionId: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * Aplica um evento (já parseado) da Hubla em `client_subscriptions`, fazendo
 * merge com o que já existe (upsert manual em vez de `.upsert()` porque
 * precisamos do id da linha para registrar o pagamento em
 * `client_subscription_payments`). Faz o match com `clients` por nome só
 * quando a assinatura ainda não tem `client_id` — uma vez vinculada (manual ou
 * automaticamente), não tentamos de novo.
 */
export async function ingestHublaEvent(
  admin: AdminClient,
  parsed: ParsedHublaEvent,
  rawBody: unknown
): Promise<IngestResult> {
  if (!parsed.subscriptionId) {
    return { ok: true, skipped: true, reason: "payload sem subscriptionId" };
  }

  const { data: existing, error: fetchError } = await admin
    .from("client_subscriptions")
    .select(
      "id, client_id, client_not_found, buyer_name, buyer_email, product_name, hubla_status, auto_renew, payment_method, billing_cycle_months, amount_cents, currency, activated_at, canceled_at, last_invoice_status, last_invoice_due_date"
    )
    .eq("source", "hubla")
    .eq("external_id", parsed.subscriptionId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };

  // Nome/email: fatura é fonte confiável (identidade de quem pagou); evento de
  // assinatura só preenche se ainda não temos nada (ver nota em parse-hubla-payload.ts).
  const buyerName =
    parsed.category === "invoice"
      ? (parsed.buyerName ?? existing?.buyer_name ?? "")
      : (existing?.buyer_name || parsed.buyerName || "");
  const buyerEmail =
    parsed.category === "invoice"
      ? (parsed.buyerEmail ?? existing?.buyer_email ?? "")
      : (existing?.buyer_email || parsed.buyerEmail || "");

  const hublaStatus = parsed.hublaStatus ?? existing?.hubla_status ?? null;
  const autoRenew = parsed.autoRenew ?? existing?.auto_renew ?? true;
  const lastInvoiceStatus = parsed.invoiceStatus ?? existing?.last_invoice_status ?? null;

  const status = deriveSubscriptionStatus({
    hublaStatus,
    autoRenew,
    lastInvoiceStatus,
  });

  // Cancelamento: `inactivatedAt` é a data oficial da Hubla; quando só temos o
  // auto-renew desligado (sem essa data), usamos "agora" como marcador da
  // primeira vez que detectamos o cancelamento.
  const canceledAt =
    parsed.inactivatedAt ??
    existing?.canceled_at ??
    (status === "canceled" ? new Date().toISOString() : null);

  const fields = {
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    product_name: parsed.productName ?? existing?.product_name ?? null,
    status,
    hubla_status: hublaStatus,
    auto_renew: autoRenew,
    payment_method: parsed.paymentMethod ?? existing?.payment_method ?? null,
    billing_cycle_months:
      parsed.billingCycleMonths ?? existing?.billing_cycle_months ?? 1,
    amount_cents: parsed.amountCents ?? existing?.amount_cents ?? 0,
    currency: parsed.currency ?? existing?.currency ?? "BRL",
    activated_at: parsed.activatedAt ?? existing?.activated_at ?? null,
    canceled_at: canceledAt,
    last_invoice_status: lastInvoiceStatus,
    last_invoice_due_date: parsed.invoiceDueDate ?? existing?.last_invoice_due_date ?? null,
    last_event_at: new Date().toISOString(),
    raw_payload: rawBody as Json,
  };

  let subscriptionRowId = existing?.id ?? null;

  if (existing) {
    const { error } = await admin
      .from("client_subscriptions")
      .update(fields)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: inserted, error } = await admin
      .from("client_subscriptions")
      .insert({ source: "hubla", external_id: parsed.subscriptionId, ...fields })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    subscriptionRowId = inserted.id;
  }

  if (!subscriptionRowId) {
    return { ok: false, error: "Falha ao obter o id da assinatura após upsert" };
  }

  // Match automático com clients — só na primeira vez (client_id ainda nulo).
  if (!existing?.client_id && buyerName) {
    const matched = await findClientByExternalName(buyerName);
    await admin
      .from("client_subscriptions")
      .update({
        client_id: matched?.id ?? null,
        client_not_found: !matched,
      })
      .eq("id", subscriptionRowId);
  } else if (!existing?.client_id) {
    // Sem nome de comprador ainda: marca como não encontrado até um evento
    // trazer a identidade (normalmente a fatura chega logo em seguida).
    await admin
      .from("client_subscriptions")
      .update({ client_not_found: true })
      .eq("id", subscriptionRowId);
  }

  // Pagamento confirmado: registra a fatura paga (dedupe pelo id da fatura) e
  // deixa o LTV como uma soma em vez de um contador — reentregas do mesmo
  // webhook não dobram o valor.
  if (
    parsed.type === "invoice.payment_succeeded" &&
    parsed.invoiceId &&
    parsed.invoiceTotalCents != null
  ) {
    const { error } = await admin.from("client_subscription_payments").upsert(
      {
        subscription_id: subscriptionRowId,
        invoice_external_id: parsed.invoiceId,
        amount_cents: parsed.invoiceTotalCents,
        currency: parsed.currency ?? "BRL",
      },
      { onConflict: "invoice_external_id" }
    );
    if (error) {
      console.error("[hubla ingest] falha ao registrar pagamento:", error.message);
    }
  }

  return { ok: true, subscriptionId: subscriptionRowId };
}
