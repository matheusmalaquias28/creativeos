import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types";

export async function getOwnedClient(
  clientId: string
): Promise<{ client: Client; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("user_id", user.id)
    .single();

  if (!client) return null;
  return { client, userId: user.id };
}
