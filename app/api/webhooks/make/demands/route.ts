import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findClientByExternalName } from "@/lib/demands/match-client";
import { parseMakeDemandPayload } from "@/lib/demands/parse-make-payload";
import { triggerMagnificGeneration } from "@/lib/magnific/trigger-generation";
import type { Database } from "@/types/database";

type CreativeDemandInsert =
  Database["public"]["Tables"]["creative_demands"]["Insert"];

// Cobre a geração de Magnific Space disparada via after() abaixo (upload de fotos +
// create + edit + polling pode passar de 1 minuto).
export const maxDuration = 300;

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.MAKE_WEBHOOK_SECRET;
  if (!secret) return true;

  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret === secret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  return false;
}

const KNOWN_STATUSES = new Set(["Nova", "Fazendo", "Revisão", "Concluída", "Cancelada"]);

/**
 * Normaliza o status vindo do Make para um dos status internos do CreativeOS.
 * Qualquer valor desconhecido (ex: "Aguardando Definição de Data") cai em "Nova".
 */
function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "Nova";
  if (KNOWN_STATUSES.has(status)) return status;
  return "Nova";
}

function parseDueDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseMakeDemandPayload(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Payload inválido: id e clientName são obrigatórios" },
      { status: 400 }
    );
  }

  const matchedClient = await findClientByExternalName(parsed.clientName);
  const clientNotFound = !matchedClient;

  const supabase = createAdminClient();
  const row: CreativeDemandInsert = {
    external_id: parsed.externalId,
    client_id: matchedClient?.id ?? null,
    client_name_external: parsed.clientName,
    client_not_found: clientNotFound,
    tipo: parsed.tipo || null,
    squad: parsed.squad || null,
    gestor: parsed.gestor || null,
    webdesigner: parsed.webdesigner || null,
    solicitante: parsed.solicitante || null,
    briefing: parsed.briefing,
    artes: parsed.artes,
    status: normalizeStatus(parsed.status),
    due_date: parseDueDate(parsed.dueDate),
    external_created_at: parseDueDate(parsed.externalCreatedAt),
    raw_payload: body as CreativeDemandInsert["raw_payload"],
  };

  const { data, error } = await supabase
    .from("creative_demands")
    .upsert(row, { onConflict: "external_id" })
    .select("id, client_id, client_not_found, external_id")
    .single();

  if (error) {
    console.error("[webhook/make/demands]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Dispara a geração automática do Space só quando o cliente está vinculado, já tem
  // material salvo, e a demanda ainda não está em geração/pronta — evita reprocessar a
  // cada re-sync do Make sobre a mesma demanda (upsert por external_id).
  if (data.client_id && !data.client_not_found) {
    const { count } = await supabase
      .from("client_photos")
      .select("id", { count: "exact", head: true })
      .eq("client_id", data.client_id);

    if (count && count > 0) {
      const { data: claimed } = await supabase
        .from("creative_demands")
        .update({
          magnific_space_status: "generating",
          magnific_space_requested_at: new Date().toISOString(),
          magnific_space_error: null,
        })
        .eq("id", data.id)
        .neq("magnific_space_status", "generating")
        .neq("magnific_space_status", "ready")
        .select("id")
        .maybeSingle();

      if (claimed) {
        after(() => triggerMagnificGeneration(data.id));
      }
    }
  }

  return NextResponse.json({
    ok: true,
    demandId: data.id,
    externalId: data.external_id,
    clientId: data.client_id,
    clientNotFound: data.client_not_found,
    message: data.client_not_found
      ? "Demanda salva com flag: Cliente não encontrado no CreativeOS"
      : "Demanda vinculada ao cliente",
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/make/demands",
    method: "POST",
  });
}
