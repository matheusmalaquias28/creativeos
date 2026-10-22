"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyWarStatusChange } from "@/lib/demands/war-status-callback";
import type { Database } from "@/types/database";
import {
  VIDEO_DEMAND_WORKING_STATUS,
  isDoneStatus,
} from "@/types/video-demand";

type VideoDemandUpdate = Database["public"]["Tables"]["video_demands"]["Update"];

export type VideoDemandStatusState = {
  error?: string;
  success?: boolean;
};

const MAX_ELAPSED_SECONDS = 3600; // 1 hora

export async function updateVideoDemandStatusAction(
  demandId: string,
  status: string
): Promise<VideoDemandStatusState> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("video_demands")
    .select("started_at, external_id, raw_payload")
    .eq("id", demandId)
    .single();

  const now = new Date();
  const isStarting = status === VIDEO_DEMAND_WORKING_STATUS;
  const isCompleted = isDoneStatus(status);

  const update: VideoDemandUpdate = {
    status,
    updated_at: now.toISOString(),
  };

  if (isStarting) {
    update.started_at = now.toISOString();
    update.completed_at = null;
    update.elapsed_seconds = null;
  }

  if (isCompleted) {
    update.is_archived = true;
    update.completed_at = now.toISOString();

    if (current?.started_at) {
      const startedAt = new Date(current.started_at);
      const rawElapsed = Math.round((now.getTime() - startedAt.getTime()) / 1000);
      update.elapsed_seconds = Math.min(rawElapsed, MAX_ELAPSED_SECONDS);
    }
  } else {
    update.is_archived = false;
  }

  const { data, error } = await supabase
    .from("video_demands")
    .update(update)
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Não foi possível atualizar a demanda de vídeo." };

  // Notifica o WAR (best-effort) — mesmo callback das demandas de arte.
  await notifyWarStatusChange({
    externalId: current?.external_id ?? null,
    status,
    rawPayload: current?.raw_payload ?? null,
  });

  revalidatePath("/videos");
  return { success: true };
}

export async function archiveVideoDemandAction(
  demandId: string
): Promise<VideoDemandStatusState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_demands")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", demandId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Não foi possível arquivar a demanda de vídeo." };

  revalidatePath("/videos");
  return { success: true };
}

export async function markVideoDemandAsReadAction(demandId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("video_demands").update({ is_new: false }).eq("id", demandId);
}
