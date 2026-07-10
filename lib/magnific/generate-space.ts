import { createAdminClient } from "@/lib/supabase/admin";
import { parseOnboardingAnswers } from "@/services/onboarding";
import { MagnificMcpSession, MagnificToolError } from "./mcp-client";
import { firstString } from "./extract";
import { buildMagnificSpaceQuery, type CreativeProfileBrief } from "./build-space-query";
import { getClientMagnificSpace, saveClientMagnificSpace } from "./client-space";
import type { DemandArte } from "@/types/demand";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADD_CREATIONS_BATCH = 20; // limite do spaces_add_creations
const EDIT_WAIT_TIMEOUT_SECONDS = 25;
const MAX_EDIT_WAIT_CALLS = 8; // ~3,5 min de teto — o timeout externo (2 min) aborta antes

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

/**
 * `client_references` é a tabela por trás da página "Referências" do cliente
 * (upload manual de referências visuais, ver actions/references.ts) — é o que
 * o usuário chama de "referências" no dia a dia, distinto de `client_photos`.
 */
async function fetchClientReferenceUrls(clientId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_references")
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

/**
 * Procura um Space existente cujo nome seja exatamente o nome do cliente.
 * O spaces_list devolve texto TOON: uma linha CSV-like por space começando com o
 * UUID; o webUrl é derivável do id, então basta casar UUID + nome na linha.
 */
async function findSpaceByName(
  session: MagnificMcpSession,
  name: string,
  signal?: AbortSignal
): Promise<GenerateSpaceResult | null> {
  const listed = await session.callTool<unknown>(
    "spaces_list",
    { query: name, perPage: 25 },
    signal
  );
  const text =
    typeof listed === "string" ? listed : firstString(listed, ["text"]) ?? JSON.stringify(listed);

  for (const line of text.split("\n")) {
    const match = line.trim().match(/^([0-9a-f-]{36}),(.*)$/i);
    if (!match) continue;
    const [, id, rest] = match;
    // Nome vem logo após o id: sem aspas até a próxima vírgula, ou entre aspas.
    const rowName = rest.startsWith('"')
      ? rest.slice(1, rest.indexOf('"', 1) === -1 ? undefined : rest.indexOf('"', 1))
      : rest.slice(0, rest.indexOf(",") === -1 ? undefined : rest.indexOf(","));
    if (rowName.trim().toLowerCase() === name.trim().toLowerCase()) {
      return { spaceId: id, spaceUrl: spaceWebUrl(id) };
    }
  }
  return null;
}

function spaceWebUrl(spaceId: string): string {
  return `https://www.magnific.com/app/spaces/${spaceId}`;
}

function extractSpace(result: unknown): GenerateSpaceResult {
  const candidates = [
    ...(firstString(result, ["spaceId"]) ? [firstString(result, ["spaceId"])!] : []),
    ...(firstString(result, ["id"]) ? [firstString(result, ["id"])!] : []),
  ];
  const spaceId = candidates.find((c) => UUID_RE.test(c));
  if (!spaceId) {
    throw new MagnificGenerationError(
      "spaces_create",
      `resposta sem UUID de space — ${JSON.stringify(result).slice(0, 300)}`
    );
  }
  return { spaceId, spaceUrl: firstString(result, ["webUrl"]) ?? spaceWebUrl(spaceId) };
}

/**
 * Gera o Space da demanda chamando o MCP do Magnific direto do backend — sem
 * agente Claude (custo Anthropic zero; todos os passos são determinísticos):
 *
 *   1. resolve o Space (mapeamento salvo → busca por nome → spaces_create)
 *   2. sobe logo + referências (creations_upload_image) e adiciona ao Space
 *   3. dispara a edição headless (spaces_edit) e espera terminar
 *      (spaces_edit_status até allTerminal)
 *
 * O único passo que consome créditos Magnific é o spaces_edit (generativo).
 */
export async function generateMagnificSpace(
  input: GenerateSpaceInput,
  opts: { signal?: AbortSignal } = {}
): Promise<GenerateSpaceResult> {
  const { signal } = opts;
  const [clientPhotoUrls, clientReferenceUrls, demandRefUrls, profile, onboardingLogoUrl, existingSpace] =
    await Promise.all([
      fetchClientPhotoUrls(input.clientId),
      fetchClientReferenceUrls(input.clientId),
      fetchDemandReferenceUrls(input.demandId),
      fetchCreativeProfile(input.clientId),
      fetchOnboardingLogoUrl(input.clientId),
      getClientMagnificSpace(input.clientId),
    ]);

  const logoUrl = profile?.logoUrl ?? onboardingLogoUrl;
  const imageUrls = Array.from(
    new Set([
      ...(logoUrl ? [logoUrl] : []),
      ...clientPhotoUrls,
      ...clientReferenceUrls,
      ...(profile?.styleUrls ?? []),
      ...demandRefUrls,
    ])
  );

  const brief = buildMagnificSpaceQuery(
    input.artes,
    input.tipo,
    profile?.brief ?? null,
    Boolean(logoUrl)
  );

  let step = "connect";
  try {
    const session = await MagnificMcpSession.connect(signal);

    // 1. Resolve o Space: mapeamento salvo → busca por nome → cria
    step = "resolve-space";
    let space = existingSpace;
    if (!space) {
      space = await findSpaceByName(session, input.clientName, signal).catch(() => null);
    }
    if (!space) {
      step = "spaces_create";
      const created = await session.callTool("spaces_create", { name: input.clientName }, signal);
      space = extractSpace(created);
    }

    // 2. Upload das imagens → identifiers → nós no Space
    step = "upload-references";
    const identifiers: string[] = [];
    for (const url of imageUrls) {
      const uploaded = await session.callTool("creations_upload_image", { url }, signal);
      const id = firstString(uploaded, ["identifier", "creationIdentifier"]);
      if (id) identifiers.push(id);
      else console.warn(`[generate-space] upload sem identifier: ${url}`);
    }

    step = "spaces_add_creations";
    for (let i = 0; i < identifiers.length; i += ADD_CREATIONS_BATCH) {
      await session.callTool(
        "spaces_add_creations",
        { spaceId: space.spaceId, creationIdentifiers: identifiers.slice(i, i + ADD_CREATIONS_BATCH) },
        signal
      );
    }

    // 3. Edição headless + espera
    step = "spaces_edit";
    const edit = await session.callTool(
      "spaces_edit",
      { spaceId: space.spaceId, query: brief },
      signal
    );
    const operationId = firstString(edit, ["operationId", "operation_id", "threadId", "thread_id"]);

    step = "spaces_edit_status";
    if (operationId) {
      let terminal = false;
      for (let i = 0; i < MAX_EDIT_WAIT_CALLS && !terminal; i++) {
        const status = await session.callTool(
          "spaces_edit_status",
          { operationId, timeoutSeconds: EDIT_WAIT_TIMEOUT_SECONDS },
          signal
        );
        const raw = JSON.stringify(status);
        terminal = raw.includes('"allTerminal":true') || /allTerminal:\s*true/.test(raw);
        const failed = firstString(status, ["status", "state"]);
        if (failed && /^(failed|error)$/i.test(failed)) {
          throw new MagnificGenerationError(
            "spaces_edit",
            firstString(status, ["error", "errorMessage"]) ?? `edição falhou (${failed})`
          );
        }
      }
      if (!terminal) {
        console.warn("[generate-space] spaces_edit não terminou dentro do teto de polling — seguindo com o Space mesmo assim");
      }
    } else {
      console.warn("[generate-space] spaces_edit sem operationId no retorno — sem como acompanhar; seguindo");
    }

    // Best-effort: grava (ou re-grava) o mapeamento cliente → Space pra próximas
    // demandas reaproveitarem.
    await saveClientMagnificSpace(input.clientId, space).catch((err: unknown) => {
      console.error(
        "[generate-space] falha ao salvar client_magnific_space:",
        err instanceof Error ? err.message : err
      );
    });

    return space;
  } catch (error) {
    if (error instanceof MagnificGenerationError) throw error;
    const message =
      error instanceof MagnificToolError || error instanceof Error
        ? error.message
        : "Erro desconhecido";
    throw new MagnificGenerationError(step, message);
  }
}
