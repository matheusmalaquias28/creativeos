import { createAdminClient } from "@/lib/supabase/admin";
import {
  isGeneratedClientName,
  isUsableClientName,
  normalizeClientName,
} from "@/lib/demands/normalize-client-name";

/**
 * Chave dentro de `clients.company_info` onde guardamos o ID fixo do cliente no
 * WAR. Não há coluna dedicada — reutilizamos o JSONB (como cnpj/source) para
 * evitar migração. É a âncora estável de vínculo demanda→cliente.
 */
const EXTERNAL_ID_KEY = "external_id";

function externalIdOf(companyInfo: unknown): string | null {
  const info =
    companyInfo && typeof companyInfo === "object"
      ? (companyInfo as Record<string, unknown>)
      : null;
  const value = info?.[EXTERNAL_ID_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isPartialNameMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 8) return false;
  return longer.includes(shorter);
}

export type ResolvedDemandClient = {
  id: string;
  name: string;
  /** True quando o vínculo veio do ID fixo do WAR (âncora estável). */
  matchedByExternalId: boolean;
};

/**
 * Resolve o cliente de uma demanda priorizando o ID fixo do WAR
 * (`externalClientId`) — que não muda entre demandas — e caindo no match por
 * nome (fuzzy) apenas como fallback. Faz uma única leitura dos clientes.
 */
export async function resolveDemandClient(params: {
  externalClientId?: string | null;
  clientName: string;
}): Promise<ResolvedDemandClient | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, company_info");
  if (error || !data?.length) return null;

  const externalClientId = params.externalClientId?.trim();
  if (externalClientId) {
    const byId = data.find((c) => externalIdOf(c.company_info) === externalClientId);
    if (byId) return { id: byId.id, name: byId.name, matchedByExternalId: true };
  }

  const { clientName } = params;
  if (!isUsableClientName(clientName) || isGeneratedClientName(clientName)) {
    return null;
  }

  const normalizedTarget = normalizeClientName(clientName);
  const named = data.filter((client) => isUsableClientName(client.name));

  const exact = named.find(
    (client) => normalizeClientName(client.name) === normalizedTarget
  );
  const partial =
    exact ??
    named.find((client) =>
      isPartialNameMatch(normalizeClientName(client.name), normalizedTarget)
    );

  return partial
    ? { id: partial.id, name: partial.name, matchedByExternalId: false }
    : null;
}

/**
 * Grava o ID fixo do WAR em `clients.company_info.external_id` (merge, sem
 * sobrescrever o resto), para que as próximas demandas do mesmo cliente casem
 * direto pelo ID. No-op se o cliente já tem o mesmo ID gravado.
 */
export async function backfillClientExternalId(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
  externalClientId: string
): Promise<void> {
  const { data } = await supabase
    .from("clients")
    .select("company_info")
    .eq("id", clientId)
    .maybeSingle();

  const info =
    data?.company_info && typeof data.company_info === "object"
      ? (data.company_info as Record<string, unknown>)
      : {};

  if (info[EXTERNAL_ID_KEY] === externalClientId) return;

  const { error } = await supabase
    .from("clients")
    .update({ company_info: { ...info, [EXTERNAL_ID_KEY]: externalClientId } })
    .eq("id", clientId);

  if (error) {
    console.error("[match-client] backfill de external_id falhou:", error.message);
  }
}

export async function findClientByExternalName(
  clientName: string
): Promise<{ id: string; name: string } | null> {
  if (!isUsableClientName(clientName) || isGeneratedClientName(clientName)) {
    return null;
  }

  const supabase = createAdminClient();
  const normalizedTarget = normalizeClientName(clientName);

  const { data, error } = await supabase.from("clients").select("id, name");

  if (error || !data?.length) return null;

  const named = data.filter((client) => isUsableClientName(client.name));

  const exact = named.find(
    (client) => normalizeClientName(client.name) === normalizedTarget
  );
  if (exact) return exact;

  const partial = named.find((client) =>
    isPartialNameMatch(normalizeClientName(client.name), normalizedTarget)
  );

  return partial ?? null;
}
