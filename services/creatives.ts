import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { GeneratedCreative } from "@/types";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

export async function getGeneratedCreatives(
  clientId: string
): Promise<GeneratedCreative[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_creatives")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throwIfDbError(error);
  return (data ?? []) as GeneratedCreative[];
}
