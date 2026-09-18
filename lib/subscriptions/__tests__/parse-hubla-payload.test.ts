import { describe, expect, it } from "vitest";
import { parseHublaWebhookPayload } from "@/lib/subscriptions/parse-hubla-payload";

const SUBSCRIPTION_CREATED = {
  type: "subscription.created",
  version: "2.0.0",
  event: {
    product: { id: "prod_1", name: "Hospedagem Pro" },
    subscription: {
      id: "sub_123",
      sellerId: "seller_1",
      payerId: "payer_1",
      type: "recurring",
      status: "inactive",
      billingCycleMonths: 1,
      paymentMethod: "credit_card",
      autoRenew: true,
      activatedAt: null,
      inactivatedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    user: {
      id: "user_1",
      firstName: "Ana",
      lastName: "Silva",
      email: "ana@example.com",
    },
  },
};

const INVOICE_PAYMENT_SUCCEEDED = {
  type: "invoice.payment_succeeded",
  version: "2.0.0",
  event: {
    product: { id: "prod_1", name: "Hospedagem Pro" },
    invoice: {
      id: "inv_1",
      subscriptionId: "sub_123",
      status: "paid",
      paymentMethod: "credit_card",
      currency: "BRL",
      amount: { totalCents: 9900, subtotalCents: 9900 },
      dueDate: "2026-02-01T00:00:00.000Z",
      payer: {
        id: "payer_1",
        firstName: "Ana",
        lastName: "Silva",
        email: "ana@example.com",
      },
    },
    subscriptions: [{ id: "sub_123", type: "recurring" }],
  },
};

describe("parseHublaWebhookPayload", () => {
  it("faz parse de um evento subscription.* extraindo id, comprador e status", () => {
    const parsed = parseHublaWebhookPayload(SUBSCRIPTION_CREATED);
    expect(parsed).toMatchObject({
      type: "subscription.created",
      category: "subscription",
      subscriptionId: "sub_123",
      buyerName: "Ana Silva",
      buyerEmail: "ana@example.com",
      productName: "Hospedagem Pro",
      hublaStatus: "inactive",
      autoRenew: true,
      paymentMethod: "credit_card",
      billingCycleMonths: 1,
    });
  });

  it("faz parse de um evento invoice.* extraindo o comprador do payer e o valor", () => {
    const parsed = parseHublaWebhookPayload(INVOICE_PAYMENT_SUCCEEDED);
    expect(parsed).toMatchObject({
      type: "invoice.payment_succeeded",
      category: "invoice",
      subscriptionId: "sub_123",
      invoiceId: "inv_1",
      buyerName: "Ana Silva",
      buyerEmail: "ana@example.com",
      invoiceStatus: "paid",
      invoiceTotalCents: 9900,
      amountCents: 9900,
    });
  });

  it("retorna null para eventos que não são de assinatura/fatura (lead, membro, etc.)", () => {
    expect(parseHublaWebhookPayload({ type: "lead.created", event: {} })).toBeNull();
  });

  it("retorna null para payload sem 'type'", () => {
    expect(parseHublaWebhookPayload({ event: {} })).toBeNull();
    expect(parseHublaWebhookPayload(null)).toBeNull();
    expect(parseHublaWebhookPayload("not an object")).toBeNull();
  });

  it("retorna subscriptionId nulo quando o evento de assinatura não traz o id", () => {
    const parsed = parseHublaWebhookPayload({
      type: "subscription.activated",
      event: { subscription: {}, user: {} },
    });
    expect(parsed?.subscriptionId).toBeNull();
  });
});
