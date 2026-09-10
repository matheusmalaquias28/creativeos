import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveDemandClient,
  backfillClientExternalId,
} from "@/lib/demands/match-client";
import { parseMakeDemandPayload } from "@/lib/demands/parse-make-payload";
import { triggerMagnificGeneration } from "@/lib/magnific/trigger-generation";
import {
  collectDemandDriveUrls,
  resolveDemandDriveFolder,
} from "@/lib/export/drive-folder";
import { DEMAND_INITIAL_STATUS } from "@/types/demand";
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

/**
 * O CreativeOS adota o vocabulário de status do WAR, então preservamos o status
 * recebido como veio (inclusive status "custom"). Só caímos no status inicial
 * padrão quando o WAR não envia nada.
 */
function normalizeStatus(status: string | null | undefined): string {
  const trimmed = status?.trim();
  return trimmed || DEMAND_INITIAL_STATUS;
}

function parseDueDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** Deriva um nome de arquivo legível a partir da URL da imagem. */
function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
    return last || "referencia";
  } catch {
    return "referencia";
  }
}

/**
 * Persiste as imagens de referência recebidas no webhook (URLs já hospedadas no
 * Storage) na tabela `demand_reference_image`, de onde alimentam tanto o painel
 * "Referências desta demanda" quanto a geração do Magnific Space
 * (`fetchDemandReferenceUrls`). Dedupe por `storage_url` para não duplicar a cada
 * re-sync do Make sobre a mesma demanda (upsert por external_id).
 */
async function ingestReferenceImages(
  supabase: ReturnType<typeof createAdminClient>,
  demandId: string,
  urls: string[]
): Promise<void> {
  if (urls.length === 0) return;

  const { data: existing } = await supabase
    .from("demand_reference_image")
    .select("storage_url, position")
    .eq("demand_id", demandId);

  const seen = new Set((existing ?? []).map((r) => r.storage_url));
  const positionBase =
    (existing ?? []).reduce((max, r) => Math.max(max, r.position ?? 0), -1) + 1;

  const inserts = urls
    .filter((url) => !seen.has(url))
    .map((url, idx) => ({
      demand_id: demandId,
      storage_path: url,
      storage_url: url,
      file_name: fileNameFromUrl(url),
      role: "use como referência visual",
      position: positionBase + idx,
    }));

  if (inserts.length === 0) return;

  const { error } = await supabase.from("demand_reference_image").insert(inserts);
  if (error) {
    console.error("[webhook/make/demands] ingest de referências falhou:", error.message);
  }
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

  // Vincula preferindo o ID fixo do WAR (não muda entre demandas); nome é fallback.
  const matchedClient = await resolveDemandClient({
    externalClientId: parsed.externalClientId,
    clientName: parsed.clientName,
  });
  const clientNotFound = !matchedClient;

  const supabase = createAdminClient();

  // Quando o vínculo veio pelo nome (fuzzy), grava o ID do WAR no cliente para
  // que as próximas demandas casem direto pelo ID.
  if (matchedClient && !matchedClient.matchedByExternalId && parsed.externalClientId) {
    await backfillClientExternalId(supabase, matchedClient.id, parsed.externalClientId);
  }
  const driveFolder = resolveDemandDriveFolder(
    collectDemandDriveUrls({
      briefing: parsed.briefing,
      artes: parsed.artes,
    })
  );
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
    drive_folder_url: driveFolder.url,
    drive_folder_id: driveFolder.id,
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

  // Persiste as imagens de referência antes de disparar a geração, para que o
  // Magnific Space já as inclua ao subir as creations.
  await ingestReferenceImages(supabase, data.id, parsed.referenceImageUrls);

  // Dispara a geração automática do Space sempre que o cliente está vinculado e a
  // demanda ainda não está em geração/pronta — evita reprocessar a cada re-sync do
  // Make sobre a mesma demanda (upsert por external_id). A geração é best-effort:
  // segue em frente mesmo sem material, usando o que estiver disponível.
  if (data.client_id && !data.client_not_found) {
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
