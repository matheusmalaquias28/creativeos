import { createClient } from "@/lib/supabase/server";
import { CREATIVE_BRAIN_GENERATION_TIMEOUT_MS } from "@/lib/constants/creative-brain-generation";
import { isSchemaMissingError, schemaNotReadyError } from "@/lib/errors/database";
import type { CreativeBrain } from "@/types";

function throwIfDbError(error: { message: string }) {
  if (isSchemaMissingError(error.message)) {
    throw schemaNotReadyError(error.message);
  }
  throw new Error(error.message);
}

export async function getCreativeBrainById(
  brainId: string,
  clientId: string
): Promise<CreativeBrain | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_brains")
    .select("*")
    .eq("id", brainId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) return null;
  return data as CreativeBrain | null;
}

export async function getCreativeBrainHistory(
  clientId: string
): Promise<CreativeBrain[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_brains")
    .select("id, client_id, version, status, generated_by, created_at, updated_at")
    .eq("client_id", clientId)
    .order("version", { ascending: false });

  if (error) throwIfDbError(error);
  return (data ?? []) as CreativeBrain[];
}

export async function getNextBrainVersion(clientId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creative_brains")
    .select("version")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.version ?? 0) + 1;
}

function generationStaleCutoffIso(): string {
  return new Date(
    Date.now() - CREATIVE_BRAIN_GENERATION_TIMEOUT_MS
  ).toISOString();
}

/** Marca gerações presas em "generating" além do tempo limite como failed. */
export async function expireStaleGeneratingBrains(
  clientId: string
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_brains")
    .update({ status: "failed" })
    .eq("client_id", clientId)
    .eq("status", "generating")
    .lt("created_at", generationStaleCutoffIso())
    .select("id");

  if (error) throwIfDbError(error);
  return data?.length ?? 0;
}

export async function getInflightGeneratingBrain(
  clientId: string
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_brains")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "generating")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throwIfDbError(error);
  return data;
}

export async function markCreativeBrainFailed(brainId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("creative_brains")
    .update({ status: "failed" })
    .eq("id", brainId);

  if (error) throwIfDbError(error);
}
