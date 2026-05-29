"use server";

import { createClient } from "@/lib/supabase/server";
import { getOwnedClient } from "@/lib/auth/verify-client";

export async function deleteCreativeAction(
  clientId: string,
  creativeId: string
): Promise<{ error?: string; success?: boolean }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { data: creative } = await supabase
    .from("generated_creatives")
    .select("storage_path")
    .eq("id", creativeId)
    .eq("client_id", clientId)
    .single();

  if (!creative) return { error: "Criativo não encontrado" };

  if (creative.storage_path && creative.storage_path !== "failed") {
    await supabase.storage
      .from("generated-creatives")
      .remove([creative.storage_path]);
  }

  const { error } = await supabase
    .from("generated_creatives")
    .delete()
    .eq("id", creativeId);

  if (error) return { error: error.message };
  return { success: true };
}
