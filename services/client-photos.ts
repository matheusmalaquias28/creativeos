import { createClient } from "@/lib/supabase/server";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";

export type ClientPhotoRow = {
  id: string;
  public_url: string;
  storage_path: string;
};

export async function getClientPhotos(clientId: string): Promise<ClientPhotoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, public_url, storage_path")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  if (error) {
    if (isSchemaMissingError(error.message)) throw schemaNotReadyError(error.message);
    throw new Error(error.message);
  }

  return data ?? [];
}
