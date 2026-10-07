"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Loader2 } from "lucide-react";
import { FrameRenderer, studioTextStyle } from "./frame-renderer";
import type { StudioHistory } from "./use-studio-history";
import { updateLayerAnywhere, updateLayers } from "@/lib/carousel-studio/doc-ops";
import type { StudioDocument, StudioLayer, StudioPage, StudioTextLayer } from "@/types/carousel-studio";

export const PAGE_GAP = 140;
const SNAP_PX = 7;
const MIN_SIZE = 12;

export type Selection = { pageId: string | null; ids: string[] };
export type ViewState = { zoom: number; panX: number; panY: number };
type Box = { x: number; y: number; width: number; height: number };
type Guide = { axis: "x" | "y"; at: number; pageId: string };

export function layerBox(layer: StudioLayer, measured: Record<string, number>): Box {
  const height = layer.type === "text" && layer.autoHeight ? measured[layer.id] ?? layer.height : layer.height;
  return { x: layer.x, y: layer.y, width: layer.width, height };
}

/** Camada que cobre a página quase toda (fundo/película) — não arrasta no 1º clique. */
function isBackdrop(layer: StudioLayer, doc: StudioDocument): boolean {
  return layer.width * layer.height >= doc.width * doc.height * 0.85 && !layer.rotation;
}

function rotate(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; panX: number; panY: number }
  | {
      kind: "move";
      pageId: string;
      sx: number;
      sy: number;
      origins: Map<string, Box>;
      moved: boolean;
    }
  | {
      kind: "resize";
      pageId: string;
      id: string;
      hx: number;
      hy: number;
      sx: number;
      sy: number;
      origin: Box;
      rotation: number;
      isText: boolean;
      fontSize: number;
      keepAspect: boolean;
    }
  | { kind: "rotate"; pageId: string; id: string; cx: number; cy: number; start: number; rotation: number }
  | { kind: "marquee"; pageId: string; sx: number; sy: number; x: number; y: number }
  | { kind: "crop"; pageId: string; id: string; sx: number; sy: number; fx: number; fy: number; w: number; h: number };

const HANDLES: Array<{ hx: number; hy: number; cursor: string }> = [
  { hx: -1, hy: -1, cursor: "nwse-resize" },
  { hx: 0, hy: -1, cursor: "ns-resize" },
  { hx: 1, hy: -1, cursor: "nesw-resize" },
  { hx: 1, hy: 0, cursor: "ew-resize" },
  { hx: 1, hy: 1, cursor: "nwse-resize" },
  { hx: 0, hy: 1, cursor: "ns-resize" },
  { hx: -1, hy: 1, cursor: "nesw-resize" },
  { hx: -1, hy: 0, cursor: "ew-resize" },
];

export type StudioCanvasProps = {
  history: StudioHistory;
  selection: Selection;
  setSelection: (s: Selection) => void;
  view: ViewState;
  setView: (v: ViewState | ((v: ViewState) => ViewState)) => void;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  cropId: string | null;
  setCropId: (id: string | null) => void;
  busyLayers: ReadonlySet<string>;
  readOnly: boolean;
  measured: Record<string, number>;
  setMeasured: (m: Record<string, number>) => void;
  spacePressed: boolean;
  onDropFiles: (pageId: string, files: File[], point: { x: number; y: number }) => void;
};

export function StudioCanvas(props: StudioCanvasProps) {
  const {
    history,
    selection,
    setSelection,
    view,
    setView,
    editingTextId,
    setEditingTextId,
    cropId,
    setCropId,
    busyLayers,
    readOnly,
    measured,
    setMeasured,
    spacePressed,
  } = props;
  const doc = history.doc;
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box & { pageId: string } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const measuredRef = useRef(measured);
  measuredRef.current = measured;

  const W = doc.width;
  const H = doc.height;
  const pageX = useCallback((index: number) => index * (W + PAGE_GAP), [W]);
  const pageIndex = useCallback((id: string) => doc.pages.findIndex((p) => p.id === id), [doc.pages]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.panX) / v.zoom, y: (clientY - rect.top - v.panY) / v.zoom };
  }, []);

  const pageAt = useCallback(
    (wx: number, wy: number): { page: StudioPage; px: number; py: number } | null => {
      const i = Math.floor(wx / (W + PAGE_GAP));
      const page = doc.pages[i];
      if (!page) return null;
      const px = wx - pageX(i);
      if (px < 0 || px > W || wy < 0 || wy > H) return null;
      return { page, px, py: wy };
    },
    [doc.pages, W, H, pageX]
  );

  // ── Medição das caixas de texto com altura automática ────────────────────
  const remeasure = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const next: Record<string, number> = {};
    let changed = false;
    world.querySelectorAll<HTMLElement>('[data-layer-type="text"]').forEach((el) => {
      const id = el.dataset.layerId!;
      next[id] = el.offsetHeight;
      if (measuredRef.current[id] !== el.offsetHeight) changed = true;
    });
    if (changed || Object.keys(next).length !== Object.keys(measuredRef.current).length) setMeasured(next);
  }, [setMeasured]);

  useLayoutEffect(() => {
    remeasure();
  }, [doc, remeasure]);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    document.fonts.ready.then(remeasure).catch(() => undefined);
    const onLoad = () => remeasure();
    document.fonts.addEventListener?.("loadingdone", onLoad);
    return () => document.fonts.removeEventListener?.("loadingdone", onLoad);
  }, [remeasure]);

  // ── Zoom/pan na roda do mouse (listener não passivo) ──────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const zoom = Math.min(4, Math.max(0.05, v.zoom * Math.exp(-e.deltaY * 0.0022)));
        const wx = (mx - v.panX) / v.zoom;
        const wy = (my - v.panY) / v.zoom;
        setView({ zoom, panX: mx - wx * zoom, panY: my - wy * zoom });
        return;
      }
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      setView({ ...v, panX: v.panX - dx, panY: v.panY - dy });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setView]);

  // ── Encaixe (snap) ─────────────────────────────────────────────────────────
  const snapTargets = useCallback(
    (page: StudioPage, exclude: Set<string>) => {
      const xs = [0, W / 2, W];
      const ys = [0, H / 2, H];
      for (const l of page.layers) {
        if (exclude.has(l.id) || l.hidden) continue;
        const b = layerBox(l, measuredRef.current);
        if (b.width >= W * 0.98 && b.height >= H * 0.98) continue;
        xs.push(b.x, b.x + b.width / 2, b.x + b.width);
        ys.push(b.y, b.y + b.height / 2, b.y + b.height);
      }
      return { xs, ys };
    },
    [W, H]
  );

  const snap = (values: number[], targets: number[], threshold: number) => {
    let best: { delta: number; at: number } | null = null;
    for (const v of values) {
      for (const t of targets) {
        const d = t - v;
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: t };
      }
    }
    return best;
  };

  // ── Ponteiro ──────────────────────────────────────────────────────────────
  const startPan = (e: ReactPointerEvent) => {
    gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, panX: view.panX, panY: view.panY };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || e.button === 2 || spacePressed) {
      if (e.button === 2) return;
      e.preventDefault();
      containerRef.current?.setPointerCapture(e.pointerId);
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (editingTextId) {
      setEditingTextId(null);
      history.endGesture();
    }
    containerRef.current?.setPointerCapture(e.pointerId);
    const world = toWorld(e.clientX, e.clientY);
    const hit = pageAt(world.x, world.y);
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-layer-id]");
    const layerId = target?.dataset.layerId ?? null;

    if (!hit) {
      if (cropId) setCropId(null);
      setSelection({ pageId: selection.pageId, ids: [] });
      startPan(e);
      return;
    }
    const { page, px, py } = hit;

    if (readOnly) {
      setSelection({ pageId: page.id, ids: [] });
      return;
    }

    // Modo recorte: arrastar move o enquadramento da imagem.
    if (cropId) {
      const crop = page.layers.find((l) => l.id === cropId);
      if (crop && crop.type === "image" && layerId === cropId) {
        history.beginGesture();
        gesture.current = { kind: "crop", pageId: page.id, id: crop.id, sx: px, sy: py, fx: crop.focusX, fy: crop.focusY, w: crop.width, h: crop.height };
        return;
      }
      setCropId(null);
    }

    const layer = layerId ? page.layers.find((l) => l.id === layerId) : null;
    if (!layer) {
      setSelection({ pageId: page.id, ids: e.shiftKey && selection.pageId === page.id ? selection.ids : [] });
      gesture.current = { kind: "marquee", pageId: page.id, sx: px, sy: py, x: px, y: py };
      return;
    }

    const alreadySelected = selection.pageId === page.id && selection.ids.includes(layer.id);
    if (e.shiftKey) {
      const ids = alreadySelected ? selection.ids.filter((id) => id !== layer.id) : [...(selection.pageId === page.id ? selection.ids : []), layer.id];
      setSelection({ pageId: page.id, ids });
      return;
    }
    if (!alreadySelected && isBackdrop(layer, doc)) {
      // Fundo: 1º clique só seleciona; arrastar a partir dele faz seleção por área.
      setSelection({ pageId: page.id, ids: [layer.id] });
      gesture.current = { kind: "marquee", pageId: page.id, sx: px, sy: py, x: px, y: py };
      return;
    }
    const ids = alreadySelected ? selection.ids : [layer.id];
    if (!alreadySelected) setSelection({ pageId: page.id, ids });

    const origins = new Map<string, Box>();
    for (const l of page.layers) {
      if (ids.includes(l.id) && !l.locked) origins.set(l.id, layerBox(l, measuredRef.current));
    }
    history.beginGesture();
    gesture.current = { kind: "move", pageId: page.id, sx: px, sy: py, origins, moved: false };
  };

  const onHandleDown = (e: ReactPointerEvent, layer: StudioLayer, page: StudioPage, hx: number, hy: number) => {
    e.stopPropagation();
    e.preventDefault();
    containerRef.current?.setPointerCapture(e.pointerId);
    const world = toWorld(e.clientX, e.clientY);
    const offset = pageX(pageIndex(page.id));
    history.beginGesture();
    gesture.current = {
      kind: "resize",
      pageId: page.id,
      id: layer.id,
      hx,
      hy,
      sx: world.x - offset,
      sy: world.y,
      origin: layerBox(layer, measuredRef.current),
      rotation: layer.rotation,
      isText: layer.type === "text",
      fontSize: layer.type === "text" ? layer.fontSize : 0,
      keepAspect: layer.type === "image" && hx !== 0 && hy !== 0,
    };
  };

  const onRotateDown = (e: ReactPointerEvent, layer: StudioLayer, page: StudioPage) => {
    e.stopPropagation();
    e.preventDefault();
    containerRef.current?.setPointerCapture(e.pointerId);
    const world = toWorld(e.clientX, e.clientY);
    const offset = pageX(pageIndex(page.id));
    const box = layerBox(layer, measuredRef.current);
    const cx = offset + box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    history.beginGesture();
    gesture.current = {
      kind: "rotate",
      pageId: page.id,
      id: layer.id,
      cx,
      cy,
      start: Math.atan2(world.y - cy, world.x - cx),
      rotation: layer.rotation,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-layer-id]");
      const id = target?.dataset.layerId ?? null;
      if (id !== hoverId) setHoverId(id);
      return;
    }
    if (g.kind === "pan") {
      setView((v) => ({ ...v, panX: g.panX + (e.clientX - g.sx), panY: g.panY + (e.clientY - g.sy) }));
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const index = pageIndex(g.pageId);
    const px = world.x - pageX(index);
    const py = world.y;
    const zoom = viewRef.current.zoom;
    const page = doc.pages[index];
    if (!page) return;

    if (g.kind === "move") {
      let dx = px - g.sx;
      let dy = py - g.sy;
      if (!g.moved && Math.hypot(dx, dy) * zoom < 3) return;
      g.moved = true;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const boxes = [...g.origins.values()];
      const minX = Math.min(...boxes.map((b) => b.x)) + dx;
      const maxX = Math.max(...boxes.map((b) => b.x + b.width)) + dx;
      const minY = Math.min(...boxes.map((b) => b.y)) + dy;
      const maxY = Math.max(...boxes.map((b) => b.y + b.height)) + dy;
      const newGuides: Guide[] = [];
      if (!e.altKey) {
        const targets = snapTargets(page, new Set(g.origins.keys()));
        const sx = snap([minX, (minX + maxX) / 2, maxX], targets.xs, SNAP_PX / zoom);
        const sy = snap([minY, (minY + maxY) / 2, maxY], targets.ys, SNAP_PX / zoom);
        if (sx) {
          dx += sx.delta;
          newGuides.push({ axis: "x", at: sx.at, pageId: page.id });
        }
        if (sy) {
          dy += sy.delta;
          newGuides.push({ axis: "y", at: sy.at, pageId: page.id });
        }
      }
      setGuides(newGuides);
      history.preview((d) =>
        updateLayers(d, g.pageId, [...g.origins.keys()], (l) => {
          const o = g.origins.get(l.id)!;
          return { x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
        })
      );
      return;
    }

    if (g.kind === "resize") {
      const o = g.origin;
      const local = rotate(px - g.sx, py - g.sy, -g.rotation);
      let w = Math.max(MIN_SIZE, o.width + g.hx * local.x);
      let h = Math.max(MIN_SIZE, o.height + g.hy * local.y);
      const keepAspect = g.keepAspect !== e.shiftKey;
      if (g.isText && g.hx !== 0 && g.hy !== 0) {
        // Canto do texto: escala a fonte junto (como no Canva/Figma "scale").
        const scale = w / o.width;
        h = o.height * scale;
      } else if (keepAspect && g.hx !== 0 && g.hy !== 0) {
        const ratio = o.width / o.height;
        if (w / h > ratio) h = w / ratio;
        else w = h * ratio;
      }
      if (g.hx === 0) w = o.width;
      if (g.hy === 0) h = o.height;
      // Mantém fixo o lado/canto oposto ao puxador.
      const shift = rotate(((w - o.width) / 2) * g.hx, ((h - o.height) / 2) * g.hy, g.rotation);
      const cx = o.x + o.width / 2 + shift.x;
      const cy = o.y + o.height / 2 + shift.y;
      const patch: Partial<StudioLayer> & Partial<StudioTextLayer> = {
        x: Math.round(cx - w / 2),
        y: Math.round(cy - h / 2),
        width: Math.round(w),
        height: Math.round(h),
      };
      if (g.isText && g.hx !== 0 && g.hy !== 0) patch.fontSize = Math.max(8, Math.round(g.fontSize * (w / o.width)));
      history.preview((d) => updateLayers(d, g.pageId, [g.id], () => patch));
      return;
    }

    if (g.kind === "rotate") {
      const angle = Math.atan2(world.y - g.cy, world.x - g.cx);
      let rotation = g.rotation + ((angle - g.start) * 180) / Math.PI;
      if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
      else if (Math.abs(((rotation % 90) + 90) % 90) < 2.5 || Math.abs(((rotation % 90) + 90) % 90) > 87.5) rotation = Math.round(rotation / 90) * 90;
      rotation = ((rotation % 360) + 360) % 360;
      if (rotation > 180) rotation -= 360;
      history.preview((d) => updateLayers(d, g.pageId, [g.id], () => ({ rotation: Math.round(rotation * 10) / 10 })));
      return;
    }

    if (g.kind === "marquee") {
      g.x = px;
      g.y = py;
      const box = { x: Math.min(g.sx, px), y: Math.min(g.sy, py), width: Math.abs(px - g.sx), height: Math.abs(py - g.sy) };
      if (box.width * zoom < 4 && box.height * zoom < 4) return;
      setMarquee({ ...box, pageId: g.pageId });
      const ids = page.layers
        .filter((l) => !l.locked && !l.hidden)
        .filter((l) => {
          const b = layerBox(l, measuredRef.current);
          if (b.width >= W * 0.98 && b.height >= H * 0.98) return false;
          return b.x < box.x + box.width && b.x + b.width > box.x && b.y < box.y + box.height && b.y + b.height > box.y;
        })
        .map((l) => l.id);
      setSelection({ pageId: g.pageId, ids });
      return;
    }

    if (g.kind === "crop") {
      const fx = Math.max(0, Math.min(100, g.fx - ((px - g.sx) / g.w) * 120));
      const fy = Math.max(0, Math.min(100, g.fy - ((py - g.sy) / g.h) * 120));
      history.preview((d) => updateLayers(d, g.pageId, [g.id], () => ({ focusX: Math.round(fx), focusY: Math.round(fy) })));
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    setGuides([]);
    setMarquee(null);
    if (!g) return;
    if (g.kind === "move" || g.kind === "resize" || g.kind === "rotate" || g.kind === "crop") history.endGesture();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    // Com pointer capture o dblclick chega no container; acha a camada pelo ponto.
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = under?.closest<HTMLElement>("[data-layer-id]");
    const id = target?.dataset.layerId;
    if (!id) return;
    const world = toWorld(e.clientX, e.clientY);
    const hit = pageAt(world.x, world.y);
    const layer = hit?.page.layers.find((l) => l.id === id);
    if (!layer || !hit) return;
    setSelection({ pageId: hit.page.id, ids: [layer.id] });
    if (layer.type === "text") {
      history.beginGesture();
      setEditingTextId(layer.id);
    } else if (layer.type === "image" && layer.src && layer.fit === "cover") {
      setCropId(layer.id);
    }
  };

  // Roda do mouse no modo recorte = zoom da imagem.
  const { commit, docRef } = history;
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !cropId) return;
    const onWheel = (e: WheelEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-layer-id]");
      if (target?.dataset.layerId !== cropId || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const found = docRef.current.pages.flatMap((p) => p.layers).find((l) => l.id === cropId);
      if (!found || found.type !== "image") return;
      const zoom = Math.min(5, Math.max(1, (found.zoom || 1) * Math.exp(-e.deltaY * 0.0015)));
      commit((d) => updateLayerAnywhere(d, cropId, { zoom: Math.round(zoom * 100) / 100 }), `crop-zoom-${cropId}`);
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [cropId, commit, docRef]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const world = toWorld(e.clientX, e.clientY);
    const hit = pageAt(world.x, world.y);
    const page = hit?.page ?? doc.pages.find((p) => p.id === selection.pageId) ?? doc.pages[0];
    if (!page) return;
    props.onDropFiles(page.id, files, { x: hit?.px ?? W / 2, y: hit?.py ?? H / 2 });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const z = view.zoom;
  const selectedPage = doc.pages.find((p) => p.id === selection.pageId) ?? null;
  const selectedLayers = selectedPage ? selectedPage.layers.filter((l) => selection.ids.includes(l.id)) : [];
  const single = selectedLayers.length === 1 && !editingTextId ? selectedLayers[0] : null;
  const editingLayer = editingTextId
    ? (doc.pages.flatMap((p) => p.layers).find((l) => l.id === editingTextId) as StudioTextLayer | undefined)
    : undefined;
  const editingPage = editingTextId ? doc.pages.find((p) => p.layers.some((l) => l.id === editingTextId)) : undefined;

  const outline = (box: Box, rotation: number, offset: number, style: CSSProperties, key?: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: offset + box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        pointerEvents: "none",
        ...style,
      }}
    />
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#1e1e22] select-none"
      style={{
        cursor: spacePressed ? (gesture.current?.kind === "pan" ? "grabbing" : "grab") : cropId ? "move" : "default",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: `${Math.max(8, 24 * z)}px ${Math.max(8, 24 * z)}px`,
        backgroundPosition: `${view.panX}px ${view.panY}px`,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHoverId(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div
        ref={worldRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${view.panX}px, ${view.panY}px) scale(${z})`,
          transformOrigin: "0 0",
        }}
      >
        {doc.pages.map((page, i) => {
          const active = page.id === selection.pageId;
          return (
            <div key={page.id} style={{ position: "absolute", left: pageX(i), top: 0, width: W, height: H }}>
              <div
                className="absolute flex items-center gap-2 font-medium whitespace-nowrap"
                style={{
                  top: -34 / z,
                  left: 0,
                  fontSize: 13 / z,
                  color: active ? "#a5b4fc" : "rgba(255,255,255,0.55)",
                  cursor: "pointer",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelection({ pageId: page.id, ids: [] });
                }}
              >
                {String(i + 1).padStart(2, "0")} · {page.name}
              </div>
              <div
                style={{
                  boxShadow: active
                    ? `0 0 0 ${2 / z}px #818cf8, 0 20px 60px rgba(0,0,0,0.5)`
                    : "0 20px 60px rgba(0,0,0,0.45)",
                }}
              >
                <FrameRenderer
                  page={page}
                  width={W}
                  height={H}
                  interactive
                  hiddenLayerId={editingTextId}
                />
              </div>
            </div>
          );
        })}

        {/* Overlays de seleção, hover, guias e status */}
        {doc.pages.map((page, i) => {
          const offset = pageX(i);
          return (
            <div key={`ov-${page.id}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
              {page.layers
                .filter((l) => busyLayers.has(l.id))
                .map((l) => {
                  const b = layerBox(l, measured);
                  return (
                    <div
                      key={`busy-${l.id}`}
                      style={{
                        position: "absolute",
                        left: offset + b.x,
                        top: b.y,
                        width: b.width,
                        height: b.height,
                        background: "rgba(10,10,15,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                      }}
                    >
                      <Loader2 className="animate-spin" style={{ width: 28 / z, height: 28 / z }} />
                    </div>
                  );
                })}
              {hoverId && !gesture.current && !selection.ids.includes(hoverId)
                ? page.layers
                    .filter((l) => l.id === hoverId)
                    .map((l) => outline(layerBox(l, measured), l.rotation, offset, { boxShadow: `0 0 0 ${1.5 / z}px #818cf8` }, `hover-${l.id}`))
                : null}
              {page.id === selection.pageId
                ? selectedLayers.map((l) =>
                    outline(
                      layerBox(l, measured),
                      l.rotation,
                      offset,
                      { boxShadow: `0 0 0 ${(l.id === cropId ? 2.5 : 1.5) / z}px ${l.id === cropId ? "#f59e0b" : "#6366f1"}` },
                      `sel-${l.id}`
                    )
                  )
                : null}
              {guides
                .filter((g) => g.pageId === page.id)
                .map((g, gi) => (
                  <div
                    key={`guide-${gi}`}
                    style={{
                      position: "absolute",
                      background: "#ec4899",
                      left: g.axis === "x" ? offset + g.at - 0.5 / z : offset,
                      top: g.axis === "x" ? 0 : g.at - 0.5 / z,
                      width: g.axis === "x" ? 1 / z : W,
                      height: g.axis === "x" ? H : 1 / z,
                    }}
                  />
                ))}
              {marquee && marquee.pageId === page.id
                ? outline(marquee, 0, offset, { background: "rgba(99,102,241,0.12)", boxShadow: `0 0 0 ${1 / z}px #6366f1` }, "marquee")
                : null}
            </div>
          );
        })}

        {/* Puxadores da seleção única */}
        {single && selectedPage && !readOnly && !single.locked && !cropId
          ? (() => {
              const offset = pageX(pageIndex(selectedPage.id));
              const b = layerBox(single, measured);
              const hs = 10 / z;
              const autoText = single.type === "text" && single.autoHeight;
              return (
                <div
                  style={{
                    position: "absolute",
                    left: offset + b.x,
                    top: b.y,
                    width: b.width,
                    height: b.height,
                    transform: single.rotation ? `rotate(${single.rotation}deg)` : undefined,
                    // A moldura cobre a camada selecionada: sem isto ela engole o
                    // clique (que não acha [data-layer-id]) e arrastar a camada já
                    // selecionada virava "clique no vazio" (desseleciona + área).
                    // Só os puxadores recebem ponteiro.
                    pointerEvents: "none",
                  }}
                >
                  {HANDLES.filter((h) => !(autoText && h.hy !== 0 && h.hx === 0)).map((h) => (
                    <div
                      key={`${h.hx}${h.hy}`}
                      onPointerDown={(e) => onHandleDown(e, single, selectedPage, h.hx, h.hy)}
                      style={{
                        position: "absolute",
                        width: hs,
                        height: hs,
                        left: ((h.hx + 1) / 2) * b.width - hs / 2,
                        top: ((h.hy + 1) / 2) * b.height - hs / 2,
                        background: "white",
                        border: `${1.5 / z}px solid #6366f1`,
                        borderRadius: 2 / z,
                        cursor: h.cursor,
                        pointerEvents: "auto",
                      }}
                    />
                  ))}
                  <div
                    onPointerDown={(e) => onRotateDown(e, single, selectedPage)}
                    title="Girar (Shift = passos de 15°)"
                    style={{
                      position: "absolute",
                      left: b.width / 2 - hs * 0.6,
                      top: -32 / z,
                      width: hs * 1.2,
                      height: hs * 1.2,
                      borderRadius: "50%",
                      background: "white",
                      border: `${1.5 / z}px solid #6366f1`,
                      cursor: "grab",
                      pointerEvents: "auto",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: b.height + 8 / z,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 11 / z,
                      padding: `${2 / z}px ${6 / z}px`,
                      borderRadius: 4 / z,
                      background: "#6366f1",
                      color: "white",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    {Math.round(b.width)} × {Math.round(b.height)}
                  </div>
                </div>
              );
            })()
          : null}

        {/* Edição de texto no lugar */}
        {editingLayer && editingPage ? (
          <InlineTextEditor
            layer={editingLayer}
            offset={pageX(pageIndex(editingPage.id))}
            zoom={z}
            onChange={(text) => history.preview((d) => updateLayerAnywhere(d, editingLayer.id, { text }))}
            onDone={() => {
              setEditingTextId(null);
              history.endGesture();
            }}
          />
        ) : null}
      </div>

      {cropId ? (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black shadow">
          Ajustando enquadramento · arraste para mover, roda do mouse para zoom · Esc para sair
        </div>
      ) : null}
    </div>
  );
}

function InlineTextEditor({
  layer,
  offset,
  zoom,
  onChange,
  onDone,
}: {
  layer: StudioTextLayer;
  offset: number;
  zoom: number;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [layer.text, layer.fontSize, layer.width]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  return (
    <textarea
      ref={ref}
      value={layer.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone();
      }}
      spellCheck
      style={{
        ...studioTextStyle(layer),
        position: "absolute",
        left: offset + layer.x,
        top: layer.y,
        width: layer.width,
        minHeight: layer.fontSize * layer.lineHeight,
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
        background: "transparent",
        border: "none",
        outline: `${2 / zoom}px solid #6366f1`,
        resize: "none",
        overflow: "hidden",
        padding: 0,
        margin: 0,
        opacity: layer.opacity,
        caretColor: layer.color,
      }}
    />
  );
}
