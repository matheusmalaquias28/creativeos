/**
 * Importação pontual (backfill) das assinaturas já existentes na Hubla, a
 * partir do CSV exportado no painel dela (Assinaturas → exportar).
 *
 * O layout de colunas do export da Hubla tem uma pegadinha: o cabeçalho lista
 * 27 campos (inclui "Trial ativo"/"Criado com trial"), mas as linhas de dados
 * só trazem 25 — essas 2 colunas nunca são escritas pelo exportador da Hubla,
 * então tudo depois delas fica deslocado 2 posições pra a esquerda em relação
 * ao cabeçalho. Por isso lemos por POSIÇÃO fixa (verificada manualmente
 * contra o arquivo real), não pelo nome do cabeçalho.
 *
 * O export de assinaturas não traz valor cobrado nem histórico de faturas —
 * então amount_cents fica 0 e o LTV (client_subscription_payments) fica vazio
 * pra essas linhas. Isso se resolve sozinho conforme o webhook for recebendo
 * eventos de fatura reais dessas assinaturas daqui pra frente.
 *
 * Uso:
 *   node scripts/import-hubla-subscriptions.mjs <caminho-do-csv> [--dry-run]
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const csvPath = process.argv[2];

if (!csvPath) {
  console.error("Uso: node scripts/import-hubla-subscriptions.mjs <caminho-do-csv> [--dry-run]");
  process.exit(1);
}

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── CSV parsing (aspas simples, campos com vírgula) ───────────────────────

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

// ─── Mapeamentos do export da Hubla ─────────────────────────────────────────

/** DD/MM/YYYY HH:MM:SS -> ISO. Retorna null se vazio/inválido. */
function parseHublaDate(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const m = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/
  );
  if (!m) return null;
  const [, day, month, year, hour = "0", min = "0", sec = "0"] = m;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(min),
    Number(sec)
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const BILLING_CYCLE_BY_PLANO = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

function billingCycleMonths(plano) {
  return BILLING_CYCLE_BY_PLANO[plano?.trim().toLowerCase()] ?? 1;
}

function mapPaymentMethod(metodo) {
  const key = metodo?.trim().toLowerCase();
  if (key === "cartão de crédito" || key === "cartao de credito") return "credit_card";
  if (key === "pix") return "pix";
  if (key === "boleto") return "bank_slip";
  return metodo || null;
}

/** "Ativo" -> active; "Inativo"/"Cancelado" -> inactive (vocabulário do webhook). */
function mapHublaStatus(status) {
  return status?.trim().toLowerCase() === "ativo" ? "active" : "inactive";
}

/** Mesma regra de lib/subscriptions/status.ts, sem invoiceStatus (não vem no export de assinaturas). */
function deriveStatus(hublaStatus, autoRenew) {
  return hublaStatus === "inactive" || !autoRenew ? "canceled" : "active";
}

// ─── Match com clients (mesma lógica de lib/demands/match-client.ts) ────────

function normalizeClientName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isPartialNameMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 8) return false;
  return longer.includes(shorter);
}

function findClientMatch(clients, buyerName) {
  const target = normalizeClientName(buyerName);
  if (!target) return null;
  const exact = clients.find((c) => normalizeClientName(c.name) === target);
  if (exact) return exact;
  return clients.find((c) => isPartialNameMatch(normalizeClientName(c.name), target)) ?? null;
}

// ─── Layout fixo das 25 colunas físicas (ver nota no topo do arquivo) ───────

const COL = {
  externalId: 0,
  plano: 1,
  status: 2,
  metodoPagamento: 3,
  dataCriacao: 4,
  dataInativacao: 5,
  dataAtivacao: 6,
  dataProximoVencimento: 7,
  dataCancelamento: 8,
  // 9 = ID do produto (não usado)
  nomeProduto: 10,
  // 11 = ID do cliente (não usado)
  nomeCliente: 12,
  // 13 = Documento do cliente (não usado)
  emailCliente: 14,
  // 15 = Telefone do cliente (não usado)
};

async function main() {
  const csvText = readFileSync(resolve(csvPath), "utf8");
  const rows = parseCsv(csvText);
  const dataRows = rows.slice(1); // primeira linha é o cabeçalho (27 colunas)

  console.log(`Lidas ${dataRows.length} assinaturas do CSV.\n`);

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name");
  if (clientsError) {
    console.error("Falha ao buscar clients:", clientsError.message);
    process.exit(1);
  }

  const results = { matched: 0, unmatched: 0, byStatus: {} };
  const unmatchedNames = [];
  const upserts = [];

  for (const row of dataRows) {
    const externalId = row[COL.externalId]?.trim();
    if (!externalId) continue;

    const buyerName = row[COL.nomeCliente]?.trim() ?? "";
    const buyerEmail = row[COL.emailCliente]?.trim().toLowerCase() ?? "";
    const hublaStatus = mapHublaStatus(row[COL.status]);
    const canceledAt = parseHublaDate(row[COL.dataCancelamento]);
    const autoRenew = !canceledAt;
    const status = deriveStatus(hublaStatus, autoRenew);

    const match = findClientMatch(clients, buyerName);
    if (match) {
      results.matched += 1;
    } else {
      results.unmatched += 1;
      unmatchedNames.push(buyerName || "(sem nome)");
    }
    results.byStatus[status] = (results.byStatus[status] ?? 0) + 1;

    upserts.push({
      source: "hubla",
      external_id: externalId,
      client_id: match?.id ?? null,
      client_not_found: !match,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      product_name: row[COL.nomeProduto]?.trim() || null,
      status,
      hubla_status: hublaStatus,
      auto_renew: autoRenew,
      payment_method: mapPaymentMethod(row[COL.metodoPagamento]),
      billing_cycle_months: billingCycleMonths(row[COL.plano]),
      amount_cents: 0,
      currency: "BRL",
      activated_at: parseHublaDate(row[COL.dataAtivacao]),
      canceled_at:
        canceledAt ??
        (status === "canceled" ? parseHublaDate(row[COL.dataInativacao]) : null),
      last_invoice_due_date: parseHublaDate(row[COL.dataProximoVencimento]),
      last_event_at: new Date().toISOString(),
      raw_payload: { importedFrom: "hubla_csv_export", row },
    });
  }

  console.log("Resumo:");
  console.log(`  Vinculadas a um cliente já cadastrado: ${results.matched}`);
  console.log(`  Sem cliente encontrado (ficam com a flag pra vincular na mão): ${results.unmatched}`);
  console.log(`  Por status: ${JSON.stringify(results.byStatus)}`);
  if (unmatchedNames.length > 0) {
    console.log(`  Nomes não encontrados: ${unmatchedNames.join(", ")}`);
  }
  console.log(
    "\n⚠ O export de assinaturas não traz valor cobrado — amount_cents fica 0 e o LTV fica vazio pra essas linhas até chegar um evento de fatura real."
  );

  if (dryRun) {
    console.log("\n--dry-run: nada foi escrito no banco.");
    return;
  }

  const { error: upsertError } = await supabase
    .from("client_subscriptions")
    .upsert(upserts, { onConflict: "source,external_id" });

  if (upsertError) {
    console.error("\nFalha ao importar:", upsertError.message);
    process.exit(1);
  }

  console.log(`\n✓ ${upserts.length} assinaturas importadas/atualizadas em client_subscriptions.`);
}

main();
