import { createAdminClient } from "@/lib/supabase/admin";
import { runMagnificSpaceAgent } from "./mcp-agent";
import { buildMagnificSpaceQuery } from "./build-space-query";
import type { DemandArte } from "@/types/demand";
import type { BrandDna } from "@/types";

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
  clientId: string;
  clientName: string;
  tipo: string | null;
  externalId: string;
  artes: DemandArte[];
};

export type GenerateSpaceResult = { spaceId: string; spaceUrl: string };

async function fetchBrandDna(clientId: string): Promise<BrandDna | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("creative_brains")
    .select("brand_dna")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.brand_dna as BrandDna | undefined) ?? null;
}

async function fetchClientPhotoUrls(clientId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("public_url")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  if (error) throw new MagnificGenerationError("fetch_photos", error.message);
  return (data ?? []).map((row) => row.public_url);
}

function buildAgentPrompt(
  input: GenerateSpaceInput,
  brandDna: BrandDna,
  photoUrls: string[]
): string {
  const brief = buildMagnificSpaceQuery(brandDna, input.artes, input.tipo);
  const spaceName = `${input.clientName} — ${input.tipo ?? "Demanda"} ${input.externalId}`;

  return [
    `Crie um novo Space no Magnific chamado "${spaceName}".`,
    `Suba estas fotos de referência do cliente (via creations_upload_image, uma URL pública por vez) e adicione todas ao Space com spaces_add_creations:`,
    photoUrls.map((url, i) => `${i + 1}. ${url}`).join("\n"),
    `Depois, use spaces_edit para gerar as artes com esta instrução: ${brief}`,
    `Acompanhe a edição com spaces_edit_status até terminar (allTerminal) antes de responder.`,
    `Quando finalizar, responda SOMENTE com um JSON no formato {"spaceId": "...", "spaceUrl": "..."} do Space criado — sem texto antes ou depois.`,
  ].join("\n\n");
}

export async function generateMagnificSpace(
  input: GenerateSpaceInput
): Promise<GenerateSpaceResult> {
  const brandDna = await fetchBrandDna(input.clientId);
  if (!brandDna) {
    throw new MagnificGenerationError("brand_dna", "Cliente não tem Creative Brain gerado.");
  }

  const photoUrls = await fetchClientPhotoUrls(input.clientId);
  if (photoUrls.length === 0) {
    throw new MagnificGenerationError("photos", "Cliente não tem material salvo.");
  }

  const prompt = buildAgentPrompt(input, brandDna, photoUrls);

  try {
    return await runMagnificSpaceAgent(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    throw new MagnificGenerationError("agent", message);
  }
}
