import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClientName } from "@/lib/demands/normalize-client-name";

export async function findClientByExternalName(
  clientName: string
): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient();
  const normalizedTarget = normalizeClientName(clientName);

  const { data, error } = await supabase.from("clients").select("id, name");

  if (error || !data?.length) return null;

  const exact = data.find(
    (client) => normalizeClientName(client.name) === normalizedTarget
  );
  if (exact) return exact;

  const partial = data.find((client) => {
    const normalizedClient = normalizeClientName(client.name);
    return (
      normalizedClient.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedClient)
    );
  });

  return partial ?? null;
}
