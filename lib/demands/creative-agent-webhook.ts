import { createHmac, randomUUID } from "crypto";

type DemandSnapshot = {
  id: string;
  external_id: string;
  client_name_external: string | null;
  briefing: unknown;
  artes: unknown;
  status: string | null;
  due_date: string | null;
  updated_at: string;
  is_archived: boolean;
};

function demandName(briefing: unknown, fallback: string): string {
  if (!briefing || typeof briefing !== "object" || Array.isArray(briefing)) return fallback;
  const title = (briefing as Record<string, unknown>).titulo;
  return typeof title === "string" && title.trim() ? title.trim() : fallback;
}

/** Entrega uma demanda estável ao agente para operação visual no Storm. */
export async function notifyCreativeDemandAgent(
  demand: DemandSnapshot,
  action: "scheduled" | "check_materials"
): Promise<boolean> {
  const url = process.env.OPENBOT_CREATIVE_DEMAND_WEBHOOK_URL?.trim();
  const secret = process.env.OPENBOT_CREATIVE_DEMAND_WEBHOOK_SECRET?.trim();
  if (!url || !secret) {
    console.warn("[creative-agent-webhook] OpenBot webhook não configurado");
    return false;
  }

  const baseUrl = process.env.CREATIVEOS_APP_URL?.trim();
  let demandUrl: string | null = null;
  if (baseUrl) {
    try {
      demandUrl = new URL(`/demands/${demand.id}`, baseUrl).toString();
    } catch {
      console.warn("[creative-agent-webhook] CREATIVEOS_APP_URL inválida; evento sem link");
    }
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const deliveryId = randomUUID();
  const body = JSON.stringify({
    type: "creative_demand_ready",
    occurredAt: new Date().toISOString(),
    data: {
      demandId: demand.id,
      externalId: demand.external_id,
      clientName: demand.client_name_external || "Cliente",
      demandName: demandName(demand.briefing, demand.external_id),
      briefing: demand.briefing,
      artes: demand.artes,
      demandUrl,
      action,
      status: demand.status,
      dueDate: demand.due_date,
      expectedUpdatedAt: demand.updated_at,
    },
  });
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${deliveryId}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openbot-timestamp": timestamp,
        "x-openbot-delivery-id": deliveryId,
        "x-openbot-signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[creative-agent-webhook] OpenBot respondeu", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "[creative-agent-webhook] falha ao acionar o agente:",
      error instanceof Error ? error.message : error
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
