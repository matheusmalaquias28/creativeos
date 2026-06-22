"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClientSchema } from "@/lib/schemas/client";
import { getOwnedClient } from "@/lib/auth/verify-client";
import { slugify } from "@/lib/utils/slug";
import { ensureUserProfile } from "@/services/users";
import type { ClientStatus } from "@/types";

export type ClientActionState = {
  error?: string;
  success?: boolean;
  clientId?: string;
  clientName?: string;
};

const ARCHIVED_FROM_STATUS_KEY = "archivedFromStatus";

function isRestorableClientStatus(value: unknown): value is ClientStatus {
  return (
    value === "draft" ||
    value === "onboarding" ||
    value === "active"
  );
}

async function insertClientForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string
): Promise<{ clientId: string; clientName: string } | { error: string }> {
  const parsed = createClientSchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;

  const { data: existingSlugs } = await supabase
    .from("clients")
    .select("slug")
    .eq("user_id", userId)
    .like("slug", `${baseSlug}%`);

  const slugSet = new Set(existingSlugs?.map((row) => row.slug) ?? []);
  let suffix = 1;
  while (slugSet.has(slug)) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: parsed.data.name,
      slug,
      status: "draft",
    })
    .select("id, name")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { clientId: data.id, clientName: data.name };
}

export async function createClientAction(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado" };
  }

  try {
    await ensureUserProfile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao sincronizar perfil";
    return { error: message };
  }

  const created = await insertClientForUser(supabase, user.id, parsed.data.name);
  if ("error" in created) {
    return { error: created.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/clients");

  return {
    success: true,
    clientId: created.clientId,
    clientName: created.clientName,
  };
}

export async function updateClientStatusAction(
  clientId: string,
  status: ClientStatus
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);

  return { success: true };
}

export async function createClientFromDemandAction(
  demandId: string
): Promise<ClientActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado" };
  }

  try {
    await ensureUserProfile();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao sincronizar perfil";
    return { error: message };
  }

  const { data: demand, error: demandError } = await supabase
    .from("creative_demands")
    .select("client_name_external")
    .eq("id", demandId)
    .maybeSingle();

  if (demandError) {
    return { error: demandError.message };
  }

  if (!demand) {
    return { error: "Demanda não encontrada" };
  }

  const created = await insertClientForUser(
    supabase,
    user.id,
    demand.client_name_external
  );

  if ("error" in created) {
    return { error: created.error };
  }

  const { data: linked, error: linkError } = await supabase
    .from("creative_demands")
    .update({
      client_id: created.clientId,
      client_not_found: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (linkError) {
    return { error: linkError.message };
  }

  if (!linked) {
    return { error: "Cliente criado, mas não foi possível vincular a demanda." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/demands");
  revalidatePath(`/demands/${demandId}`);
  revalidatePath(`/clients/${created.clientId}`);

  return {
    success: true,
    clientId: created.clientId,
    clientName: created.clientName,
  };
}

function revalidateClientPaths(clientId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath(`/clients/${clientId}/brain`);
  revalidatePath("/demands");
}

export async function archiveClientAction(
  clientId: string
): Promise<ClientActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };
  if (owned.client.status === "archived") {
    return { error: "Cliente já está arquivado" };
  }

  const supabase = await createClient();
  const company_info = {
    ...(owned.client.company_info ?? {}),
    [ARCHIVED_FROM_STATUS_KEY]: owned.client.status,
  };

  const { error } = await supabase
    .from("clients")
    .update({
      status: "archived",
      company_info,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidateClientPaths(clientId);
  return { success: true, clientId };
}

export async function unarchiveClientAction(
  clientId: string
): Promise<ClientActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };
  if (owned.client.status !== "archived") {
    return { error: "Cliente não está arquivado" };
  }

  const storedStatus = owned.client.company_info?.[ARCHIVED_FROM_STATUS_KEY];
  const restoreStatus: ClientStatus = isRestorableClientStatus(storedStatus)
    ? storedStatus
    : "active";

  const company_info = { ...(owned.client.company_info ?? {}) };
  delete company_info[ARCHIVED_FROM_STATUS_KEY];

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      status: restoreStatus,
      company_info,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) return { error: error.message };

  revalidateClientPaths(clientId);
  return { success: true, clientId };
}
