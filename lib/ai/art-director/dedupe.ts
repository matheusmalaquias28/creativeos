/**
 * Regra dura de anti-repetição dentro de uma demanda.
 *
 * O system prompt já pede variedade, mas instrução não é garantia — e "as 5
 * artes da demanda saíram iguais" é o pior modo de falha possível para quem
 * revisa 400 artes por mês. Esta camada é a rede: duas artes da mesma demanda
 * nunca terminam com o conjunto idêntico de referências.
 *
 * Pura e determinística — nenhuma chamada de modelo.
 */

import type { ChosenReference, ReferenceAsset, ReferenceCatalog } from "./types";

export type ArtReferenceSet = {
  artIndex: number;
  references: ChosenReference[];
};

export type DedupeResult = {
  sets: ArtReferenceSet[];
  /** Colisões que não deu para resolver (acervo pequeno demais). */
  warnings: string[];
};

function signature(refs: ChosenReference[]): string {
  return refs
    .map((r) => r.assetId)
    .sort()
    .join("|");
}

/**
 * Candidatos para substituição, do menos usado para o mais usado. Mesma `kind`
 * primeiro, para que a troca não destrua o papel que a referência cumpria.
 */
function candidatesFor(
  catalog: ReferenceCatalog,
  excludeIds: Set<string>,
  preferKind: string
): ReferenceAsset[] {
  const pool = catalog.entries
    .map((e) => e.asset)
    .filter((a) => !excludeIds.has(a.id));

  return pool.sort((a, b) => {
    const kindA = a.kind === preferKind ? 0 : 1;
    const kindB = b.kind === preferKind ? 0 : 1;
    if (kindA !== kindB) return kindA - kindB;
    if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
    return a.id.localeCompare(b.id);
  });
}

function usageOf(catalog: ReferenceCatalog, assetId: string): number {
  return catalog.entries.find((e) => e.asset.id === assetId)?.asset.usageCount ?? 0;
}

/** Índice da referência mais gasta do conjunto — é a que menos custa perder. */
function mostUsedIndex(refs: ChosenReference[], catalog: ReferenceCatalog): number {
  let worst = 0;
  for (let i = 1; i < refs.length; i++) {
    if (usageOf(catalog, refs[i].assetId) > usageOf(catalog, refs[worst].assetId)) {
      worst = i;
    }
  }
  return worst;
}

export function enforceDistinctReferenceSets(
  sets: ArtReferenceSet[],
  catalog: ReferenceCatalog
): DedupeResult {
  const seen = new Set<string>();
  const warnings: string[] = [];
  const out: ArtReferenceSet[] = [];

  for (const set of sets) {
    let references = [...set.references];

    // Até 3 tentativas: cada troca pode colidir com outro conjunto já visto.
    for (let attempt = 0; attempt < 3 && seen.has(signature(references)); attempt++) {
      if (references.length === 0) break;

      const present = new Set(references.map((r) => r.assetId));
      const victimIndex = mostUsedIndex(references, catalog);
      const victim = references[victimIndex];

      const replacement = candidatesFor(catalog, present, victim.role)[0];
      if (!replacement) break;

      references = references.map((ref, i) =>
        i === victimIndex
          ? {
              assetId: replacement.id,
              storageUrl: replacement.storageUrl,
              role: replacement.kind,
              intent: `variação de ${victim.role} para diferenciar esta arte das irmãs da demanda`,
            }
          : ref
      );
    }

    const sig = signature(references);
    if (seen.has(sig)) {
      warnings.push(
        `Arte ${set.artIndex}: não foi possível diferenciar as referências — acervo do cliente pequeno demais.`
      );
    }

    seen.add(sig);
    out.push({ artIndex: set.artIndex, references });
  }

  return { sets: out, warnings };
}
