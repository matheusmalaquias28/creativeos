/**
 * Operações puras sobre o documento do Studio (imutáveis). O editor só muda
 * o documento por aqui — facilita undo/redo e mantém tudo testável.
 */

import type { StudioDocument, StudioLayer, StudioPage } from "@/types/carousel-studio";
import { cloneLayer, clonePage } from "./layers";

export type LayerPatch = Partial<StudioLayer>;

export function mapPage(doc: StudioDocument, pageId: string, fn: (page: StudioPage) => StudioPage): StudioDocument {
  return { ...doc, pages: doc.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

export function findPage(doc: StudioDocument, pageId: string | null): StudioPage | null {
  return doc.pages.find((p) => p.id === pageId) ?? null;
}

export function findLayer(doc: StudioDocument, layerId: string): { page: StudioPage; layer: StudioLayer } | null {
  for (const page of doc.pages) {
    const layer = page.layers.find((l) => l.id === layerId);
    if (layer) return { page, layer };
  }
  return null;
}

export function updateLayers(
  doc: StudioDocument,
  pageId: string,
  ids: string[],
  fn: (layer: StudioLayer) => LayerPatch
): StudioDocument {
  const set = new Set(ids);
  return mapPage(doc, pageId, (page) => ({
    ...page,
    layers: page.layers.map((l) => (set.has(l.id) ? ({ ...l, ...fn(l) } as StudioLayer) : l)),
  }));
}

/** Atualiza uma camada onde quer que ela esteja (respostas assíncronas da IA). */
export function updateLayerAnywhere(doc: StudioDocument, layerId: string, patch: LayerPatch): StudioDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.layers.some((l) => l.id === layerId)
        ? { ...page, layers: page.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as StudioLayer) : l)) }
        : page
    ),
  };
}

export function addLayer(doc: StudioDocument, pageId: string, layer: StudioLayer, index?: number): StudioDocument {
  return mapPage(doc, pageId, (page) => {
    const layers = [...page.layers];
    layers.splice(index ?? layers.length, 0, layer);
    return { ...page, layers };
  });
}

export function removeLayers(doc: StudioDocument, pageId: string, ids: string[]): StudioDocument {
  const set = new Set(ids);
  return mapPage(doc, pageId, (page) => ({ ...page, layers: page.layers.filter((l) => !set.has(l.id)) }));
}

export function duplicateLayers(
  doc: StudioDocument,
  pageId: string,
  ids: string[],
  offset = 24
): { doc: StudioDocument; newIds: string[] } {
  const newIds: string[] = [];
  const next = mapPage(doc, pageId, (page) => {
    const layers = [...page.layers];
    for (const id of ids) {
      const index = layers.findIndex((l) => l.id === id);
      if (index < 0) continue;
      const copy = cloneLayer(layers[index], offset);
      copy.name = `${copy.name} (cópia)`;
      newIds.push(copy.id);
      layers.splice(index + 1, 0, copy);
    }
    return { ...page, layers };
  });
  return { doc: next, newIds };
}

export type OrderMove = "forward" | "backward" | "front" | "back";

export function reorderLayers(doc: StudioDocument, pageId: string, ids: string[], move: OrderMove): StudioDocument {
  const set = new Set(ids);
  return mapPage(doc, pageId, (page) => {
    const layers = [...page.layers];
    if (move === "front" || move === "back") {
      const moving = layers.filter((l) => set.has(l.id));
      const rest = layers.filter((l) => !set.has(l.id));
      return { ...page, layers: move === "front" ? [...rest, ...moving] : [...moving, ...rest] };
    }
    const dir = move === "forward" ? 1 : -1;
    const order = dir === 1 ? [...layers.keys()].reverse() : [...layers.keys()];
    for (const i of order) {
      if (!set.has(layers[i].id)) continue;
      const j = i + dir;
      if (j < 0 || j >= layers.length || set.has(layers[j].id)) continue;
      [layers[i], layers[j]] = [layers[j], layers[i]];
    }
    return { ...page, layers };
  });
}

/** Move uma camada para a posição `toIndex` (arrastar na lista de camadas). */
export function moveLayerTo(doc: StudioDocument, pageId: string, layerId: string, toIndex: number): StudioDocument {
  return mapPage(doc, pageId, (page) => {
    const layers = [...page.layers];
    const from = layers.findIndex((l) => l.id === layerId);
    if (from < 0) return page;
    const [layer] = layers.splice(from, 1);
    layers.splice(Math.max(0, Math.min(layers.length, toIndex)), 0, layer);
    return { ...page, layers };
  });
}

export function addPage(doc: StudioDocument, page: StudioPage, index?: number): StudioDocument {
  const pages = [...doc.pages];
  pages.splice(index ?? pages.length, 0, page);
  return { ...doc, pages };
}

export function duplicatePage(doc: StudioDocument, pageId: string): { doc: StudioDocument; newId: string | null } {
  const index = doc.pages.findIndex((p) => p.id === pageId);
  if (index < 0) return { doc, newId: null };
  const copy = clonePage(doc.pages[index]);
  return { doc: addPage(doc, copy, index + 1), newId: copy.id };
}

export function removePage(doc: StudioDocument, pageId: string): StudioDocument {
  return { ...doc, pages: doc.pages.filter((p) => p.id !== pageId) };
}

export function movePage(doc: StudioDocument, pageId: string, dir: -1 | 1): StudioDocument {
  const pages = [...doc.pages];
  const i = pages.findIndex((p) => p.id === pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pages.length) return doc;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  return { ...doc, pages };
}
