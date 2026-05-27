import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { Client, ClientReference, CreativeBrain } from "@/types";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

export async function getClientsForUser(userId: string): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throwIfDbError(error);
  return data ?? [];
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

  const { data: clients } = await supabase
    .from("clients")
    .select("id, status")
    .eq("user_id", userId);

  const clientList = clients ?? [];
  const clientIds = clientList.map((c) => c.id);

  let brains: { status: string }[] = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("creative_brains")
      .select("id, status")
      .in("client_id", clientIds);
    brains = data ?? [];
  }

  return {
    totalClients: clientList.length,
    activeClients: clientList.filter((c) => c.status === "active").length,
    onboardingClients: clientList.filter((c) => c.status === "onboarding")
      .length,
    creativeBrains: brains.length,
    approvedBrains: brains.filter((b) => b.status === "approved").length,
  };
}
