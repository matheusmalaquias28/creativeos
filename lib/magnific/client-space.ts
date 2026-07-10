import { createAdminClient } from "@/lib/supabase/admin";

export type ClientMagnificSpace = { spaceId: string; spaceUrl: string };

export async function getClientMagnificSpace(
  clientId: string
): Promise<ClientMagnificSpace | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_magnific_space")
    .select("space_id, space_url")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) return null;
  return { spaceId: data.space_id, spaceUrl: data.space_url };
}

export async function saveClientMagnificSpace(
  clientId: string,
  space: ClientMagnificSpace
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("client_magnific_space")
    .upsert(
      { client_id: clientId, space_id: space.spaceId, space_url: space.spaceUrl },
      { onConflict: "client_id" }
    );
}
