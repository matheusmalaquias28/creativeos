import { createAdminClient } from "@/lib/supabase/admin";
import { parseOnboardingAnswers } from "@/services/onboarding";

/**
 * O cliente tem material suficiente para gerar o Space? A logo é o requisito
 * duro (o worker recusa gerar sem ela — ver lib/ai/imagegen/worker.ts); fotos,
 * referências e DNA contam como material adicional. Sem client_id não há como
 * puxar material, então não gera.
 */
export async function demandHasMaterial(clientId: string | null): Promise<boolean> {
  if (!clientId) return false;
  const supabase = createAdminClient();

  const [{ data: profile }, { data: onboarding }, { count: photos }, { count: refs }] =
    await Promise.all([
      supabase
        .from("client_creative_profile")
        .select("logo_url, style_reference_urls")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("onboarding_answers")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("client_photos")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("client_references")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

  const logo =
    profile?.logo_url?.trim() ||
    parseOnboardingAnswers(onboarding ?? null).logoUrl?.trim() ||
    "";

  // Sem logo não dá pra gerar — é o requisito mínimo.
  return Boolean(logo);
}
