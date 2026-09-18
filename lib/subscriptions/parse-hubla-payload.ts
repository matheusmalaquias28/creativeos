type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fullName(record: UnknownRecord): string | null {
  const first = asString(record.firstName);
  const last = asString(record.lastName);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

/**
 * Categoria do evento — só `subscription.*` e `invoice.*` viram assinatura no
 * CreativeOS; outros (lead, membro, parcelamento, reembolso) são ignorados.
 */
export type HublaEventCategory = "subscription" | "invoice" | "other";

export type ParsedHublaEvent = {
  type: string;
  category: HublaEventCategory;
  subscriptionId: string | null;
  /** ID da própria fatura (só em eventos de fatura) — chave de dedupe dos pagamentos. */
  invoiceId: string | null;
  /**
   * Nome/email do comprador. Em eventos de fatura vêm de `invoice.payer`
   * (confiável — identidade de quem pagou). Em eventos de assinatura "puros"
   * (sem fatura junto) a doc pública da Hubla é ambígua sobre se `event.user`
   * é o comprador ou o dono da conta vendedora — por isso só usamos como
   * fallback quando ainda não há nome/email salvo. Ajustar se um payload real
   * mostrar que está errado.
   */
  buyerName: string | null;
  buyerEmail: string | null;
  productName: string | null;
  /** `subscription.status` bruto da Hubla ("active"/"inactive"), só em eventos de assinatura. */
  hublaStatus: string | null;
  autoRenew: boolean | null;
  paymentMethod: string | null;
  billingCycleMonths: number | null;
  activatedAt: string | null;
  inactivatedAt: string | null;
  /** Preço do ciclo de cobrança, quando o evento traz essa informação. */
  amountCents: number | null;
  currency: string | null;
  /** Status da fatura ("paid"/"overdue"/"unpaid"/...), só em eventos de fatura. */
  invoiceStatus: string | null;
  invoiceDueDate: string | null;
  /** Valor total da fatura — usado para acumular o total já pago quando o evento é payment_succeeded. */
  invoiceTotalCents: number | null;
};

function categoryOf(type: string): HublaEventCategory {
  if (type.startsWith("subscription.")) return "subscription";
  if (type.startsWith("invoice.")) return "invoice";
  return "other";
}

function parseSubscriptionEvent(
  event: UnknownRecord,
  type: string
): ParsedHublaEvent {
  const subscription = asRecord(event.subscription);
  const user = asRecord(event.user);
  const product = asRecord(event.product);

  return {
    type,
    category: "subscription",
    subscriptionId: asString(subscription.id),
    invoiceId: null,
    buyerName: fullName(user),
    buyerEmail: asString(user.email),
    productName: asString(product.name),
    hublaStatus: asString(subscription.status),
    autoRenew: asBoolean(subscription.autoRenew),
    paymentMethod: asString(subscription.paymentMethod),
    billingCycleMonths: asNumber(subscription.billingCycleMonths),
    activatedAt: asString(subscription.activatedAt),
    inactivatedAt: asString(subscription.inactivatedAt),
    amountCents: null,
    currency: null,
    invoiceStatus: null,
    invoiceDueDate: null,
    invoiceTotalCents: null,
  };
}

function parseInvoiceEvent(event: UnknownRecord, type: string): ParsedHublaEvent {
  const invoice = asRecord(event.invoice);
  const payer = asRecord(invoice.payer);
  const amount = asRecord(invoice.amount);
  const product = asRecord(event.product);
  const subscriptions = asArray(event.subscriptions).map(asRecord);
  const subscriptionId =
    asString(invoice.subscriptionId) ?? asString(subscriptions[0]?.id);

  return {
    type,
    category: "invoice",
    subscriptionId,
    invoiceId: asString(invoice.id),
    buyerName: fullName(payer),
    buyerEmail: asString(payer.email),
    productName: asString(product.name),
    hublaStatus: null,
    autoRenew: null,
    paymentMethod: asString(invoice.paymentMethod),
    billingCycleMonths: null,
    activatedAt: null,
    inactivatedAt: null,
    amountCents: asNumber(amount.totalCents),
    currency: asString(invoice.currency),
    invoiceStatus: asString(invoice.status),
    invoiceDueDate: asString(invoice.dueDate),
    invoiceTotalCents: asNumber(amount.totalCents),
  };
}

/**
 * Faz o parse do payload bruto do webhook da Hubla (`{ type, version, event }`)
 * para um formato normalizado. Retorna `null` quando o payload não tem o
 * formato esperado ou não é um evento de assinatura/fatura que nos interessa.
 */
export function parseHublaWebhookPayload(body: unknown): ParsedHublaEvent | null {
  const root = asRecord(body);
  const type = asString(root.type);
  if (!type) return null;

  const event = asRecord(root.event);
  const category = categoryOf(type);

  if (category === "subscription") return parseSubscriptionEvent(event, type);
  if (category === "invoice") return parseInvoiceEvent(event, type);
  return null;
}
