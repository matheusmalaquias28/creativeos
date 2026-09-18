import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseHublaWebhookPayload } from "@/lib/subscriptions/parse-hubla-payload";
import { ingestHublaEvent } from "@/lib/subscriptions/ingest";

/**
 * A Hubla autentica o webhook enviando o token configurado no header
 * `x-hubla-token` (ver https://hubla.gitbook.io/docs/webhooks/proteja-seu-endpoint).
 * O valor é o "Hubla Webhook Token" (Integrações → Webhook → aba
 * Authentication no painel da Hubla), guardado em `HUBLA_AUTENTICATION_TOKEN`.
 * Sem essa env configurada, libera (dev).
 */
function verifyHublaToken(request: Request): boolean {
  const secret = process.env.HUBLA_AUTENTICATION_TOKEN;
  if (!secret) return true;
  return request.headers.get("x-hubla-token") === secret;
}

export async function POST(request: Request) {
  if (!verifyHublaToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseHublaWebhookPayload(body);
  if (!parsed) {
    // Evento que não é de assinatura/fatura (lead, membro, parcelamento, reembolso)
    // ou payload fora do formato esperado — confirma recebimento sem processar.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();
  const result = await ingestHublaEvent(admin, parsed, body);

  if (!result.ok) {
    console.error("[webhook/hubla/subscriptions]", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/hubla/subscriptions",
    method: "POST",
    auth: "header x-hubla-token (HUBLA_AUTENTICATION_TOKEN)",
  });
}
