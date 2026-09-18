import { describe, expect, it } from "vitest";
import { deriveSubscriptionStatus } from "@/lib/subscriptions/status";

describe("deriveSubscriptionStatus", () => {
  it("ativa quando hublaStatus=active, auto-renew ligado e sem problema de fatura", () => {
    expect(
      deriveSubscriptionStatus({
        hublaStatus: "active",
        autoRenew: true,
        lastInvoiceStatus: "paid",
      })
    ).toBe("active");
  });

  it("cancelada quando hublaStatus=inactive, mesmo com auto-renew ligado", () => {
    expect(
      deriveSubscriptionStatus({
        hublaStatus: "inactive",
        autoRenew: true,
        lastInvoiceStatus: "paid",
      })
    ).toBe("canceled");
  });

  it("cancelada quando auto-renew está desligado, mesmo com hublaStatus=active", () => {
    expect(
      deriveSubscriptionStatus({
        hublaStatus: "active",
        autoRenew: false,
        lastInvoiceStatus: "paid",
      })
    ).toBe("canceled");
  });

  it("problema no pagamento quando a última fatura está overdue/unpaid/disputed/chargeback", () => {
    for (const status of ["overdue", "unpaid", "disputed", "chargeback"]) {
      expect(
        deriveSubscriptionStatus({
          hublaStatus: "active",
          autoRenew: true,
          lastInvoiceStatus: status,
        })
      ).toBe("payment_issue");
    }
  });

  it("cancelamento tem prioridade sobre problema de pagamento", () => {
    expect(
      deriveSubscriptionStatus({
        hublaStatus: "inactive",
        autoRenew: true,
        lastInvoiceStatus: "overdue",
      })
    ).toBe("canceled");
  });
});
