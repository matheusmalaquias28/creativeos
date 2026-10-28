/**
 * Distribui as imagens de uma Lista do Space pelos slots de entrega (Arte N,
 * 1-based) de modo que TODAS possam ir ao Drive, mesmo quando a lista tem mais
 * imagens do que a demanda tem artes (ou a demanda não tem artes no briefing):
 * - imagem com arte de origem conhecida fica nela (a primeira, se várias
 *   vieram da mesma arte);
 * - imagem sem origem conhecida ocupa o primeiro slot livre, na ordem da lista;
 * - variação extra de uma arte já ocupada vai para um slot novo depois das
 *   artes da demanda — nunca toma o lugar de outra arte.
 */
export function assignListDriveSlots(resolved: (number | null)[], artCount: number): number[] {
  const taken = new Set<number>();
  const assigned = resolved.map((slot) => {
    if (slot === null || taken.has(slot)) return null;
    taken.add(slot);
    return slot;
  });

  const takeFree = (from: number) => {
    let slot = from;
    while (taken.has(slot)) slot += 1;
    taken.add(slot);
    return slot;
  };

  resolved.forEach((slot, i) => {
    if (slot === null) assigned[i] = takeFree(1);
  });
  assigned.forEach((slot, i) => {
    if (slot === null) assigned[i] = takeFree(artCount + 1);
  });

  return assigned as number[];
}
