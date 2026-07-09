import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type ArtJob = Database["public"]["Tables"]["art_generation_job"]["Row"];
export type ArtVersion = Database["public"]["Tables"]["art_version"]["Row"];
export type CreativeProfile =
  Database["public"]["Tables"]["client_creative_profile"]["Row"];

export type ArtJobWithVersions = ArtJob & {
  versions: ArtVersion[];
  currentVersion: ArtVersion | null;
};

// ---------------------------------------------------------------------------
// Queries (server-side, auth client)
// ---------------------------------------------------------------------------

export async function getJobsForDemand(
  demandId: string
): Promise<ArtJobWithVersions[]> {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from("art_generation_job")
    .select("*")
    .eq("demand_id", demandId)
    .order("art_index", { ascending: true });

  if (error) throw new Error(error.message);
  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);

  const { data: versions, error: vError } = await supabase
    .from("art_version")
    .select("*")
    .in("job_id", jobIds)
    .order("version_number", { ascending: false });

  if (vError) throw new Error(vError.message);

  return jobs.map((job) => {
    const jobVersions = (versions ?? []).filter((v) => v.job_id === job.id);
    const current = jobVersions.find((v) => v.is_current) ?? null;
    return { ...job, versions: jobVersions, currentVersion: current };
  });
}

export async function getCreativeProfile(
  clientId: string
): Promise<CreativeProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_creative_profile")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Mutations (admin client — bypass RLS for server actions)
// ---------------------------------------------------------------------------

export async function approveJob(jobId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("art_generation_job")
    .update({ approved: true })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export type DemandReferenceImage = {
  id: string;
  storage_url: string;
  file_name: string;
  role: string | null;
  position: number;
};

export async function getDemandReferenceImages(
  demandId: string
): Promise<DemandReferenceImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("demand_reference_image")
    .select("id, storage_url, file_name, role, position")
    .eq("demand_id", demandId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertCreativeProfile(
  clientId: string,
  data: Database["public"]["Tables"]["client_creative_profile"]["Insert"]
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("client_creative_profile")
    .upsert({ ...data, client_id: clientId }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
