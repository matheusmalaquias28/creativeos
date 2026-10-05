/**
 * Quando uma demanda é "do tipo carrossel".
 *
 * O WAR manda `tipo = "arte"` para quase tudo; o formato real vem em
 * `briefing.tipo` / `tipoArte` ("Carrossel" vs "Estática"). Demandas antigas
 * só dizem isso no título ("… - CARROSSEL | …"), então o título também conta.
 */

const CAROUSEL_PATTERN = /carross[eé]l|carousel/i;

type DemandLike = {
  tipo?: string | null;
  briefing?: { tipo?: string | null; titulo?: string | null } | null;
  raw_payload?: unknown;
};

function rawTipoArte(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const value = record.tipoArte ?? (record.briefing as Record<string, unknown> | undefined)?.tipoArte;
  return typeof value === "string" ? value : "";
}

export function isCarouselDemand(demand: DemandLike): boolean {
  const candidates = [
    demand.briefing?.tipo,
    rawTipoArte(demand.raw_payload),
    demand.tipo,
    demand.briefing?.titulo,
  ];
  return candidates.some((value) => typeof value === "string" && CAROUSEL_PATTERN.test(value));
}
