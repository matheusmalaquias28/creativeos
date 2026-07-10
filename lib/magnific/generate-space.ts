import { createAdminClient } from "@/lib/supabase/admin";
import { parseOnboardingAnswers } from "@/services/onboarding";
import { runMagnificSpaceAgent } from "./mcp-agent";
import { buildMagnificSpaceQuery, type CreativeProfileBrief } from "./build-space-query";
import type { DemandArte } from "@/types/demand";

export class MagnificGenerationError extends Error {
  constructor(
    public readonly step: string,
    message: string
  ) {
    super(`[${step}] ${message}`);
    this.name = "MagnificGenerationError";
  }
}

export type GenerateSpaceInput = {
  demandId: string;
  clientId: string;
  clientName: string;
  tipo: string | null;
  externalId: string;
  artes: DemandArte[];
};

export type GenerateSpaceResult = { spaceId: string; spaceUrl: string };

async function fetchClientPhotoUrls(clientId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_photos")
    .select("public_url")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => row.public_url);
}

async function fetchDemandReferenceUrls(demandId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("demand_reference_image")
    .select("storage_url")
    .eq("demand_id", demandId)
    .order("position", { ascending: true });

  return (data ?? []).map((row) => row.storage_url);
}

async function fetchCreativeProfile(
  clientId: string
): Promise<{ logoUrl: string | null; brief: CreativeProfileBrief; styleUrls: string[] } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_creative_profile")
    .select("base_prompt, palette, style_reference_urls, logo_url")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) return null;

  return {
    logoUrl: data.logo_url ?? null,
    brief: {
      basePrompt: data.base_prompt ?? "",
      palette: Array.isArray(data.palette) ? (data.palette as string[]) : [],
    },
    styleUrls: Array.isArray(data.style_reference_urls)
      ? (data.style_reference_urls as string[])
      : [],
  };
}

async function fetchOnboardingLogoUrl(clientId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("onboarding_answers")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  const parsed = parseOnboardingAnswers(data ?? null);
  return parsed.logoUrl?.trim() ? parsed.logoUrl : null;
}

function buildAgentPrompt(
  input: GenerateSpaceInput,
  logoUrl: string | null,
  imageUrls: string[],
  brief: string
): string {
  const spaceName = `${input.clientName} — ${input.tipo ?? "Demanda"} ${input.externalId}`;
  const parts: string[] = [`Crie um novo Space no Magnific chamado "${spaceName}".`];

  if (logoUrl) {
    parts.push(
      `Suba a logo do cliente (${logoUrl}) via creations_upload_image e adicione ao Space com spaces_add_creations.`
    );
  }

  if (imageUrls.length > 0) {
    parts.push(
      [
        "Suba estas imagens de referência (via creations_upload_image, uma URL por vez) e adicione todas ao Space com spaces_add_creations:",
        imageUrls.map((url, i) => `${i + 1}. ${url}`).join("\n"),
      ].join("\n")
    );
  } else {
    parts.push(
      "Não há imagens de referência disponíveis para este cliente/demanda — gere usando apenas as instruções de texto abaixo."
    );
  }

  parts.push(`Depois, use spaces_edit com esta instrução: ${brief}`);
  parts.push("Acompanhe a edição com spaces_edit_status até terminar (allTerminal) antes de responder.");
  parts.push(
    'Quando finalizar, responda SOMENTE com um JSON no formato {"spaceId": "...", "spaceUrl": "..."} do Space criado — sem texto antes ou depois.'
  );

  return parts.join("\n\n");
}

export async function generateMagnificSpace(
  input: GenerateSpaceInput,
  opts: { signal?: AbortSignal } = {}
): Promise<GenerateSpaceResult> {
  const [clientPhotoUrls, demandRefUrls, profile, onboardingLogoUrl] = await Promise.all([
    fetchClientPhotoUrls(input.clientId),
    fetchDemandReferenceUrls(input.demandId),
    fetchCreativeProfile(input.clientId),
    fetchOnboardingLogoUrl(input.clientId),
  ]);

  const logoUrl = profile?.logoUrl ?? onboardingLogoUrl;
  const imageUrls = Array.from(
    new Set([...clientPhotoUrls, ...(profile?.styleUrls ?? []), ...demandRefUrls])
  );

  const brief = buildMagnificSpaceQuery(input.artes, input.tipo, profile?.brief ?? null);
  const prompt = buildAgentPrompt(input, logoUrl, imageUrls, brief);

  try {
    return await runMagnificSpaceAgent(prompt, opts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    throw new MagnificGenerationError("agent", message);
  }
}
