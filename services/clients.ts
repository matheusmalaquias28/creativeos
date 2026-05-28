import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { Client, ClientListItem, ClientReference, CreativeBrain } from "@/types";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

function extractLogoUrl(answers: unknown): string | null {
  if (!answers || typeof answers !== "object") return null;
  const logoUrl = (answers as { logoUrl?: unknown }).logoUrl;
  return typeof logoUrl === "string" && logoUrl.trim() ? logoUrl : null;
}

export async function getClientsForUser(userId: string): Promise<ClientListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, onboarding_answers(answers)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throwIfDbError(error);

  return (data ?? []).map((client) => {
    const ob = client.onboarding_answers as { answers?: unknown } | { answers?: unknown }[] | null;
    const answers = Array.isArray(ob) ? ob[0]?.answers : ob?.answers;
    return {
      id: client.id,
      user_id: client.user_id,
      name: client.name,
      slug: client.slug,
      status: client.status,
      company_info: client.company_info,
      created_at: client.created_at,
      updated_at: client.updated_at,
      logoUrl: extractLogoUrl(answers ?? null),
    };
  });
}

export async function getClientById(
  clientId: string,
  userId: string
): Promise<Client | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function getClientReferences(
  clientId: string
): Promise<ClientReference[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_references")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  if (error) throwIfDbError(error);
  return data ?? [];
}

export async function getLatestCreativeBrain(
  clientId: string
): Promise<CreativeBrain | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_brains")
    .select("*")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as CreativeBrain | null;
}

export async function getDashboardStats(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("id, status, creative_brains(id, status)")
    .eq("user_id", userId);

  const clientList = data ?? [];
  const brains = clientList.flatMap(
    (c) => (c.creative_brains as { id: string; status: string }[] ?? [])
  );

  return {
    totalClients: clientList.length,
    activeClients: clientList.filter((c) => c.status === "active").length,
    onboardingClients: clientList.filter((c) => c.status === "onboarding").length,
    creativeBrains: brains.length,
    approvedBrains: brains.filter((b) => b.status === "approved").length,
  };
}
