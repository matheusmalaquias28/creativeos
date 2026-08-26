import type { CreativeDemandListItem } from "@/types/demand";

export function getDemandCardTitle(
  demand: Pick<CreativeDemandListItem, "briefing" | "artes">
): string {
  const titulo = demand.briefing.titulo?.trim();
  if (titulo) return titulo;
  const headline = demand.artes[0]?.headline?.trim();
  if (headline) return headline;
  return "Sem título";
}

export function getDemandCardTipo(
  demand: Pick<CreativeDemandListItem, "tipo" | "briefing">
): string | null {
  const tipo = demand.tipo?.trim() || demand.briefing.tipo?.trim();
  return tipo || null;
}
