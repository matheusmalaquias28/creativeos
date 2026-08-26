import { createAdminClient } from "@/lib/supabase/admin";
import {
  isGeneratedClientName,
  isUsableClientName,
  normalizeClientName,
} from "@/lib/demands/normalize-client-name";

function isPartialNameMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 8) return false;
  return longer.includes(shorter);
}

export async function findClientByExternalName(
  clientName: string
): Promise<{ id: string; name: string } | null> {
  if (!isUsableClientName(clientName) || isGeneratedClientName(clientName)) {
    return null;
  }

  const supabase = createAdminClient();
  const normalizedTarget = normalizeClientName(clientName);

  const { data, error } = await supabase.from("clients").select("id, name");

  if (error || !data?.length) return null;

  const named = data.filter((client) => isUsableClientName(client.name));

  const exact = named.find(
    (client) => normalizeClientName(client.name) === normalizedTarget
  );
  if (exact) return exact;

  const partial = named.find((client) =>
    isPartialNameMatch(normalizeClientName(client.name), normalizedTarget)
  );

  return partial ?? null;
}
