/**
 * Catálogo de referências em texto.
 *
 * A decisão central da camada: anotar cada referência com IA de visão no upload
 * e entregar ao diretor de arte um catálogo em TEXTO, não 40 imagens. Escolher
 * referência vira problema de texto — ~800 tokens em vez de megabytes de imagem,
 * e o histórico de uso cabe na mesma linha, que é o que permite anti-repetição.
 *
 * Determinístico e testável: mesma entrada (incluindo `now`) → mesma saída.
 */

import type { CatalogEntry, ReferenceAsset, ReferenceCatalog } from "./types";

/** Teto de itens no catálogo. Acima disso o prompt incha sem ganho de escolha. */
export const MAX_CATALOG_ENTRIES = 40;

/**
 * Quota de artes próprias promovidas ao acervo. Acervo só de output próprio
 * converge — o sistema passa a copiar a si mesmo. Metade é o teto.
 */
export const WINNER_QUOTA = 0.5;

function daysBetween(fromIso: string, now: Date): number {
  const then = new Date(fromIso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export function describeUsage(asset: ReferenceAsset, now: Date): string {
  if (asset.usageCount === 0 || !asset.lastUsedAt) return "nunca usada";

  const days = daysBetween(asset.lastUsedAt, now);
  const times = asset.usageCount === 1 ? "1x" : `${asset.usageCount}x`;

  if (!Number.isFinite(days)) return `usada ${times}`;
  if (days <= 0) return `usada ${times}, última hoje`;
  if (days === 1) return `usada ${times}, última ontem`;
  return `usada ${times}, última há ${days} dias`;
}

/**
 * Ordena para que o que o modelo lê primeiro seja o que ele deveria preferir:
 * subusado antes de usado, e não-winner antes de winner (contra convergência).
 * Empate resolvido por `position` e depois por id — determinístico.
 */
export function sortForCatalog(assets: ReferenceAsset[]): ReferenceAsset[] {
  return [...assets].sort((a, b) => {
    if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
    if (a.isWinner !== b.isWinner) return a.isWinner ? 1 : -1;
    return a.id.localeCompare(b.id);
  });
}

/** Aplica a quota de winners, preservando a ordem recebida. */
export function applyWinnerQuota(
  assets: ReferenceAsset[],
  limit = MAX_CATALOG_ENTRIES
): ReferenceAsset[] {
  const maxWinners = Math.floor(limit * WINNER_QUOTA);
  const out: ReferenceAsset[] = [];
  let winners = 0;

  for (const asset of assets) {
    if (out.length >= limit) break;
    if (asset.isWinner) {
      if (winners >= maxWinners) continue;
      winners += 1;
    }
    out.push(asset);
  }

  return out;
}

function formatEntry(entry: CatalogEntry, now: Date): string {
  const { token, asset } = entry;
  const description = asset.aiDescription?.trim() || "(sem descrição)";
  const tags = asset.aiTags.length ? ` [${asset.aiTags.join(", ")}]` : "";
  const winner = asset.isWinner ? " (arte aprovada do próprio cliente)" : "";
  return `${token} | ${asset.kind} | ${description}${tags}${winner} | ${describeUsage(asset, now)}`;
}

/**
 * Monta o catálogo. Tokens são posicionais (`r01`, `r02`…) e não fatias de uuid:
 * não colidem e o modelo não tem que copiar 36 caracteres sem errar.
 */
export function buildReferenceCatalog(
  assets: ReferenceAsset[],
  now: Date = new Date(),
  limit = MAX_CATALOG_ENTRIES
): ReferenceCatalog {
  const selected = applyWinnerQuota(sortForCatalog(assets), limit);

  const entries: CatalogEntry[] = selected.map((asset, i) => ({
    token: `r${String(i + 1).padStart(2, "0")}`,
    asset,
  }));

  const byToken = new Map(entries.map((e) => [e.token, e.asset]));

  const text = entries.length
    ? entries.map((e) => formatEntry(e, now)).join("\n")
    : "(acervo vazio)";

  return { text, entries, byToken };
}
