/**
 * Estado do estúdio de criativos de uma demanda.
 *
 * Uma leitura só, com o que o modal precisa para o primeiro render: o job, o
 * prompt que o operador pode editar, a arte 3:4 atual e a story 9:16 atual. O
 * Realtime cobre tudo que chega depois — isto aqui existe para quem reabre o
 * modal com as artes já prontas.
 *
 * Os tipos moram em `lib/art-studio/types.ts` porque o modal é client component
 * e este arquivo importa o Supabase de servidor.
 */

import { createClient } from "@/lib/supabase/server";
import type { ArtFormat, StudioArtUrls, StudioJob, StudioState } from "@/lib/art-studio/types";

export type { ArtFormat, StoryStatus, StudioArtUrls, StudioJob, StudioState } from "@/lib/art-studio/types";
export { effectiveStudioPrompt } from "@/lib/art-studio/types";

const JOB_COLUMNS =
  "id, demand_id, art_index, status, approved, prompt_draft, prompt_edited, error, story_status, story_error, direction, params";

export async function getStudioState(demandId: string): Promise<StudioState> {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from("art_generation_job")
    .select(JOB_COLUMNS)
    .eq("demand_id", demandId)
    .order("art_index", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (jobs ?? []) as unknown as StudioJob[];
  const urls: StudioArtUrls = { feed: {}, story: {} };

  if (rows.length === 0) return { jobs: rows, urls };

  const { data: versions } = await supabase
    .from("art_version")
    .select("job_id, result_url, format")
    .in(
      "job_id",
      rows.map((j) => j.id)
    )
    .eq("is_current", true);

  for (const version of versions ?? []) {
    const format = ((version.format as string) ?? "feed") as ArtFormat;
    if (format !== "feed" && format !== "story") continue;
    urls[format][version.job_id as string] = version.result_url as string;
  }

  return { jobs: rows, urls };
}
