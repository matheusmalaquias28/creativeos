/**
 * Webhook do Instagram (Meta).
 *
 *  GET  — verificação: ao salvar o webhook no painel da Meta, ela chama esta
 *         URL com hub.mode=subscribe, hub.verify_token e hub.challenge. Se o
 *         token bate com INSTAGRAM_WEBHOOK_VERIFY_TOKEN, devolvemos o
 *         challenge em texto puro.
 *  POST — eventos (comentários, menções…). Por ora só confirma o recebimento:
 *         a publicação não depende deles. Com INSTAGRAM_APP_SECRET definido, a
 *         assinatura X-Hub-Signature-256 é conferida.
 *
 * Rota pública: a Meta chama sem sessão (o middleware só barra páginas).
 */

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();

  if (!expected) {
    console.error("[instagram/webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN não configurado");
    return new NextResponse("Webhook não configurado", { status: 500 });
  }
  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Token de verificação inválido", { status: 403 });
}

function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const received = Buffer.from(header.slice("sha256=".length));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (secret && !validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Assinatura inválida", { status: 401 });
  }

  try {
    const body = JSON.parse(raw) as { object?: string; entry?: Array<{ changes?: Array<{ field?: string }> }> };
    const fields = (body.entry ?? []).flatMap((e) => (e.changes ?? []).map((c) => c.field)).filter(Boolean);
    console.info("[instagram/webhook] evento", body.object, fields.join(","));
  } catch {
    // Corpo inesperado: confirma do mesmo jeito para a Meta não reenviar sem parar.
  }
  return NextResponse.json({ received: true });
}
