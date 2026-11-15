import { createClient } from "@/lib/supabase/server";

export type DemandComment = {
  id: string;
  author: string | null;
  body: string;
  images: string[];
  createdAt: string;
};

/** Comentários (vindos do WAR) de uma demanda de arte ou de vídeo, do mais antigo ao mais novo. */
export async function getDemandComments(
  target: { demandId: string } | { videoDemandId: string }
): Promise<DemandComment[]> {
  const supabase = await createClient();
  const column = "demandId" in target ? "demand_id" : "video_demand_id";
  const value = "demandId" in target ? target.demandId : target.videoDemandId;

  const { data, error } = await supabase
    .from("demand_comments")
    .select("id, author, body, images, external_created_at, created_at")
    .eq(column, value)
    .order("external_created_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    // Tabela ainda não migrada ou falha pontual: a página segue sem comentários.
    console.error("[getDemandComments]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    author: row.author,
    body: row.body,
    images: Array.isArray(row.images)
      ? row.images.filter((url): url is string => typeof url === "string")
      : [],
    createdAt: row.external_created_at ?? row.created_at,
  }));
}
