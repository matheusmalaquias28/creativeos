/**
 * Apaga do bucket demand-exports os arquivos que já foram entregues ao Drive
 * do cliente (drive_file_id preenchido) antes da limpeza automática existir.
 * A arte continua acessível no Drive — só a cópia redundante no Supabase
 * Storage é removida, que era o que estava estourando o limite de armazenamento.
 *
 * Uso: node scripts/cleanup-delivered-exports.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const BUCKET = "demand-exports";

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
  console.log(`\n🧹 Limpeza de exports já entregues${dryRun ? " (dry-run)" : ""}\n`);

  const { data: rows, error } = await supabase
    .from("demand_export_files")
    .select("id, storage_path, filename, drive_file_id")
    .not("drive_file_id", "is", null);

  if (error) {
    console.error("❌ Erro ao buscar demand_export_files:", error.message);
    process.exit(1);
  }

  const targets = (rows ?? []).filter((r) => r.storage_path);
  console.log(`   ${targets.length} arquivo(s) já entregue(s) ao Drive encontrados no Storage`);

  if (targets.length === 0) {
    console.log("\n✅ Nada a fazer.\n");
    return;
  }

  const paths = targets.map((r) => r.storage_path);
  console.log(dryRun ? "   (dry-run — nenhum arquivo será removido)" : "   removendo do bucket demand-exports...");

  if (!dryRun) {
    const chunkSize = 100;
    let removed = 0;
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize);
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(chunk);
      if (removeError) {
        console.error(`     ❌ falhou num lote: ${removeError.message}`);
        continue;
      }
      removed += chunk.length;
    }
    console.log(`\n✅ ${removed}/${paths.length} arquivo(s) removido(s) do Storage.\n`);
  } else {
    for (const t of targets) {
      console.log(`   → ${t.filename} (${t.storage_path})`);
    }
    console.log(`\n✅ ${targets.length} arquivo(s) seriam removidos.\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message ?? err);
  process.exit(1);
});
