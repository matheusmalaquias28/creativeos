import {
  isUsableClientName,
  normalizeClientName,
} from "@/lib/demands/normalize-client-name";

/**
 * Vincula todas as demandas ainda sem cliente que compartilham o mesmo nome
 * externo. Usado quando 3 demandas da mesma leva chegam antes do cadastro.
 */
export async function linkUnmatchedDemandsByExternalName(
  supabase: { from: (relation: "creative_demands") => unknown },
  params: { clientId: string; externalName: string }
): Promise<string[]> {
  if (!isUsableClientName(params.externalName)) return [];

  const target = normalizeClientName(params.externalName);
  const table = supabase.from.bind(supabase);

  const selectBuilder = table("creative_demands") as {
    select: (columns: "id, client_name_external") => {
      eq: (
        column: "client_not_found",
        value: true
      ) => Promise<{
        data: { id: string; client_name_external: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };

  const { data: unmatched, error } = await selectBuilder
    .select("id, client_name_external")
    .eq("client_not_found", true);

  if (error || !unmatched?.length) return [];

  const ids = unmatched
    .filter((row) => normalizeClientName(row.client_name_external) === target)
    .map((row) => row.id);

  if (ids.length === 0) return [];

  const updateBuilder = table("creative_demands") as {
    update: (values: {
      client_id: string;
      client_not_found: false;
      updated_at: string;
    }) => {
      in: (
        column: "id",
        values: string[]
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error: updateError } = await updateBuilder
    .update({
      client_id: params.clientId,
      client_not_found: false,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (updateError) {
    console.error("[linkUnmatchedDemandsByExternalName]", updateError.message);
    return [];
  }

  return ids;
}
