/**
 * Cria (ou atualiza) o usuário admin de desenvolvimento no Supabase Auth.
 *
 * Uso: npm run seed:admin
 * Requer: SUPABASE_SERVICE_ROLE_KEY no .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEV_ADMIN_EMAIL ?? "admin@creativeos.dev";
const password = process.env.DEV_ADMIN_PASSWORD ?? "CreativeOS2025!";
const fullName = process.env.DEV_ADMIN_NAME ?? "Administrador";

if (!url || !serviceKey) {
  console.error(
    "\n❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
  console.error(
    "   Service role: Supabase Dashboard → Settings → API → service_role\n"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureProfileRole(userId, userEmail) {
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  const { error } = profile
    ? await supabase
        .from("users")
        .update({ email: userEmail, full_name: fullName, role: "admin" })
        .eq("id", userId)
    : await supabase.from("users").insert({
        id: userId,
        email: userEmail,
        full_name: fullName,
        role: "admin",
      });

  if (error) {
    console.warn("⚠️  Perfil public.users:", error.message);
  }
}

async function main() {
  console.log("\n🔐 Creative OS — seed admin de teste\n");

  const existing = await findUserByEmail(email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        app_metadata: { role: "admin" },
        user_metadata: { full_name: fullName },
      }
    );
    if (error) throw error;
    await ensureProfileRole(data.user.id, data.user.email ?? email);
    console.log("✅ Admin existente atualizado");
    console.log(`   ID:    ${data.user.id}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    await ensureProfileRole(data.user.id, data.user.email ?? email);
    console.log("✅ Admin criado com sucesso");
    console.log(`   ID:    ${data.user.id}`);
  }

  console.log(`   Email: ${email}`);
  console.log(`   Senha: ${password}`);
  console.log("\n   Faça login em /login\n");
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message ?? err);
  process.exit(1);
});
