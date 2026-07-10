import { createAdminClient } from "@/lib/supabase/admin";

export type FlowCreativeProfile = {
  logo_url: string | null;
  style_reference_urls: string[] | null;
};

/**
 * Perfil criativo do cliente pro enrich do Fluxo (logo + referências visuais).
 * `client_creative_profile.style_reference_urls` nunca é escrito em lugar
 * nenhum do app hoje — a fonte real de referências é `client_references`
 * (a página "Referências" do cliente), então ela entra sempre como fallback.
 */
export async function loadFlowCreativeProfile(
  clientId: string | null
): Promise<FlowCreativeProfile | null> {
  if (!clientId) return null;

  const supabase = createAdminClient();
  const [{ data: profile }, { data: refRows }] = await Promise.all([
    supabase
      .from("client_creative_profile")
      .select("logo_url, style_reference_urls")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("client_references")
      .select("public_url")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
  ]);

  const referenceUrls = Array.from(
    new Set([...(profile?.style_reference_urls ?? []), ...(refRows ?? []).map((r) => r.public_url)])
  );

  if (!profile && referenceUrls.length === 0) return null;

  return {
    logo_url: profile?.logo_url ?? null,
    style_reference_urls: referenceUrls,
  };
}
