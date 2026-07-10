/**
 * Aplica migrations no Postgres remoto do Supabase.
 *
 * Uso: npm run db:setup
 * Requer no .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_DB_PASSWORD (Settings → Database → Database password)
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const migrationsDir = resolve(root, "supabase/migrations");

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword =
  process.env.SUPABASE_DB_PASSWORD ?? process.env.DATABASE_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

function getProjectRef(url) {
  const match = url?.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1];
}

function buildConnectionString(ref, password) {
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  let connectionString = databaseUrl;

  if (!connectionString) {
    const ref = getProjectRef(supabaseUrl);
    if (!ref || !dbPassword) {
      console.error("\n❌ Banco não configurado no .env.local\n");
      console.error("Adicione a senha do Postgres (não é a service_role):");
      console.error("  Supabase Dashboard → Settings → Database → Database password\n");
      console.error("No .env.local:");
      console.error("  SUPABASE_DB_PASSWORD=sua_senha_do_banco\n");
      console.error("Ou cole a connection string completa:");
      console.error("  DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres\n");
      console.error("Alternativa: rode o SQL manualmente em SQL Editor:");
      console.error("  supabase/setup.sql\n");
      process.exit(1);
    }
    connectionString = buildConnectionString(ref, dbPassword);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("Nenhuma migration em supabase/migrations/");
    process.exit(1);
  }

  const sql = postgres(connectionString, { ssl: "require", max: 1 });

  console.log("\n📦 Creative OS — aplicando schema no Supabase\n");

  try {
    // Garante tabela de controle de migrations
    await sql.unsafe(`
      create table if not exists public.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const [{ count: trackCount }] =
      await sql`select count(*)::int as count from public.schema_migrations`;

    // Bootstrap: se a tabela de controle está vazia mas o schema principal já existe,
    // registra todas as migrations como aplicadas (evita re-rodar o schema inicial).
    if (trackCount === 0) {
      const [{ exists: schemaExists }] = await sql`
        select exists (
          select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'clients'
        ) as exists
      `;
      if (schemaExists) {
        console.log("   ℹ️  Detectado schema existente — registrando migrations já aplicadas...");
        // Determina quais estão aplicadas verificando objetos concretos no banco
        const checks = {
          "20250527000000_initial_schema.sql": sql`select exists (select 1 from pg_type where typname = 'client_status') as e`,
          "20250527100000_user_roles.sql": sql`select exists (select 1 from pg_type where typname = 'user_role') as e`,
          "20250527200000_users_insert_policy.sql": sql`select exists (select 1 from pg_policies where policyname = 'Users can insert own profile') as e`,
          "20250527300000_client_logos_bucket.sql": sql`select exists (select 1 from storage.buckets where id = 'client-logos') as e`,
          "20250528100000_generated_creatives.sql": sql`select exists (select 1 from information_schema.tables where table_name = 'generated_creatives') as e`,
          "20250528200000_client_photos_bucket.sql": sql`select exists (select 1 from storage.buckets where id = 'client-photos') as e`,
          "20250528300000_client_photos_table.sql": sql`select exists (select 1 from information_schema.tables where table_name = 'client_photos') as e`,
          "20250529100000_creative_brain_failed_status.sql": sql`select exists (select 1 from pg_enum where enumlabel = 'failed') as e`,
          "20250609100000_creative_demands.sql": sql`select exists (select 1 from information_schema.tables where table_name = 'creative_demands') as e`,
          "20250611100000_creative_demands_update_policy.sql": sql`select exists (select 1 from pg_policies where policyname = 'Authenticated users can update demands') as e`,
          "20250611110000_creative_demands_realtime.sql": sql`select exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'creative_demands') as e`,
          "20260617000000_client_creative_profile.sql": sql`select exists (select 1 from information_schema.tables where table_name = 'client_creative_profile') as e`,
          "20260617100000_art_generation_job.sql": sql`select exists (select 1 from information_schema.tables where table_name = 'art_generation_job') as e`,
          "20260617200000_art_version.sql": sql`select exists (select 1 from information_schema.tables where table_name = 'art_version') as e`,
        };
        for (const [file, query] of Object.entries(checks)) {
          const [{ e }] = await query;
          if (e && files.includes(file)) {
            await sql`insert into public.schema_migrations (version) values (${file}) on conflict do nothing`;
            console.log(`      ✓ ${file}`);
          }
        }
      }
    }

    const applied = await sql`select version from public.schema_migrations`;
    const appliedSet = new Set(applied.map((r) => r.version));

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`   ✓ ${file} (já aplicada)`);
        continue;
      }
      const path = join(migrationsDir, file);
      const content = readFileSync(path, "utf8");
      console.log(`   → ${file}`);
      await sql.unsafe(content);
      await sql`insert into public.schema_migrations (version) values (${file})`;
      count++;
    }

    // Recarrega schema cache do PostgREST após mudanças
    if (count > 0) {
      await sql.unsafe("NOTIFY pgrst, 'reload schema'");
    }

    console.log(
      count > 0
        ? `\n✅ ${count} migration(s) aplicada(s) com sucesso!`
        : "\n✅ Banco já atualizado — nenhuma migration pendente."
    );
    console.log("   Rode: npm run seed:admin (se ainda não criou o admin)\n");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\n❌ Erro ao aplicar migrations:", err.message ?? err);
  console.error("\nConfira SUPABASE_DB_PASSWORD ou use supabase/setup.sql no SQL Editor.\n");
  process.exit(1);
});
