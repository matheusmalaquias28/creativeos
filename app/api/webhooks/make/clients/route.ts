import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import {
  isUsableClientName,
  normalizeClientName,
} from "@/lib/demands/normalize-client-name";
import { linkUnmatchedDemandsByExternalName } from "@/lib/demands/link-unmatched-siblings";

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.MAKE_WEBHOOK_SECRET;
  if (!secret) return true;

  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret === secret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  return false;
}

function parsePayload(body: unknown): { name: string; cnpj?: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const name = typeof b.nome === "string" ? b.nome.trim() : null;
  if (!name || name.length < 2) return null;
  const cnpj = typeof b.cnpj === "string" ? b.cnpj.trim() : undefined;
  return { name, cnpj };
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

  const parsed = parsePayload(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Payload inválido: campo 'nome' é obrigatório" },
      { status: 400 }
    );
  }

  if (!isUsableClientName(parsed.name)) {
    return NextResponse.json(
      {
        error:
          "Nome do cliente inválido. Identificadores automáticos não podem ser cadastrados.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const normalizedName = normalizeClientName(parsed.name);

  // Check if client with same name already exists
  const { data: existing } = await supabase
    .from("clients")
    .select("id, name, slug, user_id");

  const existingMatch = existing?.find(
    (c) => normalizeClientName(c.name) === normalizedName
  );

  if (existingMatch) {
    const linkedIds = await linkUnmatchedDemandsByExternalName(supabase, {
      clientId: existingMatch.id,
      externalName: parsed.name,
    });
    return NextResponse.json({
      ok: true,
      clientId: existingMatch.id,
      demandsLinked: linkedIds.length,
      message: "Cliente já existe no CreativeOS",
      skipped: true,
    });
  }

  // Need a user_id — use the admin user in the system (single-tenant)
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!users?.id) {
    return NextResponse.json(
      { error: "Nenhum usuário encontrado no sistema" },
      { status: 500 }
    );
  }

  // Generate unique slug
  const baseSlug = slugify(parsed.name);
  if (!baseSlug) {
    return NextResponse.json(
      { error: "Nome do cliente inválido para cadastro" },
      { status: 400 }
    );
  }
  let slug = baseSlug;
  const { data: existingSlugs } = await supabase
    .from("clients")
    .select("slug")
    .eq("user_id", users.id)
    .like("slug", `${baseSlug}%`);

  const slugSet = new Set(existingSlugs?.map((r) => r.slug) ?? []);
  let suffix = 1;
  while (slugSet.has(slug)) {
    slug = `${baseSlug}-${suffix++}`;
  }

  // Create the client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      user_id: users.id,
      name: parsed.name,
      slug,
      status: "onboarding",
      company_info: {
        cnpj: parsed.cnpj ?? null,
        source: "webhook",
      },
    })
    .select("id, name, slug")
    .single();

  if (clientError) {
    console.error("[webhook/make/clients]", clientError.message);
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  const linkedIds = await linkUnmatchedDemandsByExternalName(supabase, {
    clientId: client.id,
    externalName: parsed.name,
  });

  return NextResponse.json({
    ok: true,
    clientId: client.id,
    clientName: client.name,
    slug: client.slug,
    demandsLinked: linkedIds.length,
    message:
      linkedIds.length > 0
        ? `Cliente criado e ${linkedIds.length} demanda(s) vinculada(s)`
        : "Cliente criado com sucesso",
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/make/clients",
    method: "POST",
    body: { nome: "string (obrigatório)", cnpj: "string (opcional)" },
  });
}
