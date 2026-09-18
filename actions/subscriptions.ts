"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SALESPERSON_OPTIONS, type Salesperson } from "@/types/subscription";

export type SubscriptionActionState = {
  error?: string;
  success?: boolean;
  clientId?: string;
  clientName?: string;
};

const SALESPERSON_VALUES = new Set<string>(
  SALESPERSON_OPTIONS.map((option) => option.value)
);

export async function linkSubscriptionToClientAction(
  subscriptionId: string,
  clientId: string
): Promise<SubscriptionActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (clientError) return { error: clientError.message };
  if (!client) return { error: "Cliente não encontrado ou sem permissão." };

  const { data, error } = await supabase
    .from("client_subscriptions")
    .update({ client_id: client.id, client_not_found: false })
    .eq("id", subscriptionId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Não foi possível vincular a assinatura." };

  revalidatePath("/assinaturas");

  return { success: true, clientId: client.id, clientName: client.name };
}

export async function assignSubscriptionSalespersonAction(
  subscriptionId: string,
  salesperson: Salesperson | null
): Promise<SubscriptionActionState> {
  if (salesperson !== null && !SALESPERSON_VALUES.has(salesperson)) {
    return { error: "Vendedor inválido." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase
    .from("client_subscriptions")
    .update({ salesperson })
    .eq("id", subscriptionId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Não foi possível atualizar o vendedor." };

  revalidatePath("/assinaturas");

  return { success: true };
}
