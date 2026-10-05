import { after } from "next/server";
import { claimStudioGeneration, ensureStudioForDemand } from "@/services/carousel-studio";
import { runStudioGeneration } from "./generate";

/**
 * Envio automático de demandas de carrossel para o Studio.
 *
 * Chamado quando a demanda chega (webhook) e quando ela é vinculada a um
 * cliente. Só dispara a geração na PRIMEIRA vez (studio ainda `idle`) — um
 * re-sync do WAR sobre a mesma demanda não gasta geração de novo.
 *
 * Desligue com `CAROUSEL_STUDIO_AUTOGENERATE=false` (o studio continua sendo
 * criado; a geração vira manual pelo botão na demanda).
 *
 * Precisa rodar no escopo de uma requisição (usa `after()`), e nunca lança:
 * falha aqui não pode derrubar o webhook.
 */
export async function autoRouteCarouselDemand(demandId: string): Promise<void> {
  try {
    const studio = await ensureStudioForDemand(demandId);
    if (!studio || studio.status !== "idle") return;
    if (process.env.CAROUSEL_STUDIO_AUTOGENERATE?.trim().toLowerCase() === "false") return;

    const claim = await claimStudioGeneration(studio.id);
    if (!claim.ok) return;
    after(() => runStudioGeneration(studio.id).catch((e) => console.error("[carousel-studio/auto]", e)));
  } catch (error) {
    console.error("[carousel-studio/auto] falha ao rotear demanda", demandId, error);
  }
}
