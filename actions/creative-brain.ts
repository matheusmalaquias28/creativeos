"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateCreativeBrain } from "@/lib/ai/generateCreativeBrain";
import { getOwnedClient } from "@/lib/auth/verify-client";
import {
  CREATIVE_BRAIN_GENERATION_TIMEOUT_MS,
  CREATIVE_BRAIN_TIMEOUT_MESSAGE,
} from "@/lib/constants/creative-brain-generation";
import {
  CreativeBrainGenerationTimeoutError,
  isCreativeBrainTimeoutError,
} from "@/lib/errors/creative-brain-generation";
import {
  expireStaleGeneratingBrains,
  getInflightGeneratingBrain,
  getNextBrainVersion,
  markCreativeBrainFailed,
} from "@/services/creative-brain";
import {
  getOnboardingAnswers,
  parseOnboardingAnswers,
  isOnboardingComplete,
} from "@/services/onboarding";
import { getClientReferences } from "@/services/clients";
import { withTimeout } from "@/lib/utils/with-timeout";
import type { OnboardingFormValues } from "@/lib/schemas/client";

export type CreativeBrainActionState = {
  error?: string;
  success?: boolean;
  brainId?: string;
};

/** Sincroniza fila: expira registros "generating" antigos (chamado ao abrir a página). */
export async function syncCreativeBrainGenerationAction(
  clientId: string
): Promise<{ expired: number }> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { expired: 0 };

  const expired = await expireStaleGeneratingBrains(clientId);
  if (expired > 0) {
    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clients/${clientId}/brain`);
  }
  return { expired };
}

export async function generateCreativeBrainAction(
  clientId: string
): Promise<CreativeBrainActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const onboardingRecord = await getOnboardingAnswers(clientId);
  const answers = parseOnboardingAnswers(onboardingRecord);

  if (!isOnboardingComplete(answers)) {
    return {
      error: "Complete o onboarding antes de gerar o Creative Brain",
    };
  }

  await expireStaleGeneratingBrains(clientId);

  const inflight = await getInflightGeneratingBrain(clientId);
  if (inflight) {
    return {
      error:
        "Já existe uma geração em andamento para este cliente. Aguarde ou atualize a página.",
    };
  }

  const references = await getClientReferences(clientId);
  const supabase = await createClient();
  const version = await getNextBrainVersion(clientId);

  const { data: brainRow, error: insertError } = await supabase
    .from("creative_brains")
    .insert({
      client_id: clientId,
      status: "generating",
      version,
      generated_by: owned.userId,
      brand_dna: {},
    })
    .select("id")
    .single();

  if (insertError || !brainRow) {
    return { error: insertError?.message ?? "Erro ao iniciar geração" };
  }

  try {
    const brandDna = await withTimeout(
      generateCreativeBrain(
        answers as OnboardingFormValues,
        references,
        owned.client.name
      ),
      CREATIVE_BRAIN_GENERATION_TIMEOUT_MS,
      CreativeBrainGenerationTimeoutError
    );

    const { error: updateError } = await supabase
      .from("creative_brains")
      .update({ brand_dna: brandDna, status: "draft" })
      .eq("id", brainRow.id);

    if (updateError) throw new Error(updateError.message);

    await supabase
      .from("clients")
      .update({ status: "active" })
      .eq("id", clientId);

    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clients/${clientId}/brain`);

    return { success: true, brainId: brainRow.id };
  } catch (e) {
    await markCreativeBrainFailed(brainRow.id);

    const message = isCreativeBrainTimeoutError(e)
      ? CREATIVE_BRAIN_TIMEOUT_MESSAGE
      : e instanceof Error
        ? e.message
        : "Falha na geração com IA";

    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clients/${clientId}/brain`);

    return { error: message, brainId: brainRow.id };
  }
}

export async function approveCreativeBrainAction(
  clientId: string,
  brainId: string
): Promise<CreativeBrainActionState> {
  const owned = await getOwnedClient(clientId);
  if (!owned) return { error: "Cliente não encontrado" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("creative_brains")
    .update({ status: "approved" })
    .eq("id", brainId)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/brain`);

  return { success: true };
}
