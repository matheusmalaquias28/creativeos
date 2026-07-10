/**
 * Semeia client_flow_graph a partir do flow_graph legado (por demanda), pra clientes
 * que já tinham um fluxo salvo antes da mudança pra fluxo compartilhado por cliente.
 *
 * Só copia o flow_graph da demanda mais recente de cada cliente (a que provavelmente
 * tem as edições mais atuais) — demandas adicionais do mesmo cliente se auto-fundem
 * nesse grafo na próxima vez que a página /flow delas for aberta (via
 * getOrCreateClientFlowGraph, já namespaced corretamente).
 *
 * Não sobrescreve client_flow_graph já existente.
 *
 * Uso: node scripts/backfill-client-flow-graphs.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

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
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("\n❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local\n");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`\n📦 Backfill client_flow_graph${dryRun ? " (dry-run)" : ""}\n`);

  const { data: demands, error } = await supabase
    .from("creative_demands")
    .select("id, client_id, flow_graph, updated_at")
    .not("client_id", "is", null)
    .not("flow_graph", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("❌ Erro ao buscar demandas:", error.message);
    process.exit(1);
  }

  // Já ordenado por updated_at desc — a primeira ocorrência de cada client_id é a mais recente.
  const latestByClient = new Map();
  for (const d of demands ?? []) {
    if (!latestByClient.has(d.client_id)) latestByClient.set(d.client_id, d);
  }

  console.log(`   ${latestByClient.size} cliente(s) com flow_graph legado encontrado(s)`);

  let seeded = 0;
  let skipped = 0;

  for (const [clientId, demand] of latestByClient) {
    const { data: existing } = await supabase
      .from("client_flow_graph")
      .select("client_id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const graph = demand.flow_graph;
    if (!graph?.nodes?.length) continue;

    console.log(`   → cliente ${clientId} ← demanda ${demand.id} (${graph.nodes.length} nós)`);
    if (!dryRun) {
      const { error: upsertError } = await supabase
        .from("client_flow_graph")
        .upsert({ client_id: clientId, graph }, { onConflict: "client_id" });
      if (upsertError) {
        console.error(`     ❌ falhou: ${upsertError.message}`);
        continue;
      }
    }
    seeded++;
  }

  console.log(
    `\n✅ ${seeded} cliente(s) semeado(s), ${skipped} já tinham client_flow_graph.${
      dryRun ? " (dry-run — nada foi escrito)" : ""
    }\n`
  );
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message ?? err);
  process.exit(1);
});
