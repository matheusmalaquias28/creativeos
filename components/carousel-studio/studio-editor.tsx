"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Circle,
  CloudOff,
  Download,
  ImagePlus,
  Images,
  Loader2,
  Maximize2,
  Minus,
  MousePointerClick,
  Plus,
  Redo2,
  Send,
  Sparkles,
  Square,
  Stamp,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  addLayer,
  addPage,
  duplicateLayers,
  duplicatePage,
  findLayer,
  findPage,
  movePage,
  removeLayers,
  removePage,
  reorderLayers,
  updateLayerAnywhere,
  updateLayers,
} from "@/lib/carousel-studio/doc-ops";
import {
  cloneLayer,
  makeButtonLayer,
  makeImageLayer,
  makePage,
  makeShapeLayer,
  makeTextLayer,
} from "@/lib/carousel-studio/layers";
import { nearestAspect } from "@/lib/carousel-studio/layouts";
import { deriveRoles } from "@/lib/carousel-studio/color";
import { STUDIO_FONTS } from "@/lib/carousel-studio/fonts";
import {
  isStudioBusy,
  isStudioDocument,
  type StudioCarousel,
  type StudioDocument,
  type StudioGeneration,
  type StudioLayer,
  type StudioStatus,
} from "@/types/carousel-studio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudioHistory } from "./use-studio-history";
import { PAGE_GAP, StudioCanvas, type Selection, type ViewState } from "./studio-canvas";
import { LayersPanel } from "./layers-panel";
import { PropertiesPanel, type ImageActions } from "./properties-panel";
import { FrameRenderer } from "./frame-renderer";
import { AiImageDialog, ReferencesDialog, RegenerateDialog } from "./studio-dialogs";
import { downloadBlob, renderFrameToBlob, uploadPageToDemand } from "./export";

type SaveState = "saved" | "dirty" | "saving" | "error";

export type StudioEditorProps = {
  initial: StudioCarousel;
  demandReferenceUrls: string[];
  backHref: string;
  backLabel: string;
};

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/** Grava a altura medida dos textos automáticos (export/miniatura/servidor). */
function withMeasuredHeights(doc: StudioDocument, measured: Record<string, number>): StudioDocument {
  return {
    ...doc,
    pages: doc.pages.map((p) => ({
      ...p,
      layers: p.layers.map((l) =>
        l.type === "text" && l.autoHeight && measured[l.id] && measured[l.id] !== l.height ? { ...l, height: measured[l.id] } : l
      ),
    })),
  };
}

function ToolButton({
  title,
  onClick,
  disabled,
  children,
  active,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35",
        active && "bg-white/10 text-white"
      )}
    >
      {children}
    </button>
  );
}

export function StudioEditor({ initial, demandReferenceUrls, backHref, backLabel }: StudioEditorProps) {
  const carouselId = initial.id;
  const history = useStudioHistory(initial.document);
  const doc = history.doc;

  const [status, setStatus] = useState<StudioStatus>(initial.status);
  const [generation, setGeneration] = useState<StudioGeneration>(initial.generation);
  const [name, setName] = useState(initial.name);
  const [caption, setCaption] = useState(initial.caption ?? "");
  const [brief, setBrief] = useState(initial.brief ?? "");
  const [brand, setBrand] = useState(initial.brand);
  const [extraRefs, setExtraRefs] = useState<string[]>(initial.reference_urls);
  const [selection, setSelection] = useState<Selection>({ pageId: initial.document.pages[0]?.id ?? null, ids: [] });
  const [view, setView] = useState<ViewState>({ zoom: 0.4, panX: 80, panY: 80 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [busyLayers, setBusyLayers] = useState<Set<string>>(new Set());
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const [spacePressed, setSpacePressed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [exporting, setExporting] = useState<null | "download-one" | "download-all" | "demand">(null);
  const [dialogs, setDialogs] = useState({ regenerate: false, references: false, ai: false });

  const busy = isStudioBusy(status);
  const readOnly = busy || exporting !== null;
  const statusRef = useRef(status);
  statusRef.current = status;
  const measuredRef = useRef(measured);
  measuredRef.current = measured;
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const clipboard = useRef<StudioLayer[]>([]);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const addImageInputRef = useRef<HTMLInputElement>(null);

  const palette = useMemo(() => {
    const fromBrand = (brand.palette ?? []).filter(Boolean);
    const roles = deriveRoles(fromBrand);
    return Array.from(new Set([...fromBrand, roles.dark, roles.light, "#ffffff", "#000000"])).slice(0, 14);
  }, [brand.palette]);

  const activePage = findPage(doc, selection.pageId) ?? doc.pages[0] ?? null;
  const selectedLayers = activePage ? activePage.layers.filter((l) => selection.ids.includes(l.id)) : [];

  // Página selecionada sumiu (undo/remoção) → cai na primeira.
  useEffect(() => {
    if (!findPage(doc, selection.pageId) && doc.pages[0]) setSelection({ pageId: doc.pages[0].id, ids: [] });
  }, [doc, selection.pageId]);

  // ── Enquadramento da tela ─────────────────────────────────────────────────
  const fitPage = useCallback(
    (pageId?: string | null, all = false) => {
      const el = canvasWrapRef.current;
      if (!el || doc.pages.length === 0) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (all) {
        const totalW = doc.pages.length * doc.width + (doc.pages.length - 1) * PAGE_GAP;
        const zoom = Math.min((cw - 120) / totalW, (ch - 140) / doc.height, 1);
        setView({ zoom, panX: (cw - totalW * zoom) / 2, panY: (ch - doc.height * zoom) / 2 + 10 });
        return;
      }
      const index = Math.max(0, doc.pages.findIndex((p) => p.id === (pageId ?? selection.pageId)));
      const zoom = Math.min((cw - 140) / doc.width, (ch - 140) / doc.height, 1);
      const pageLeft = index * (doc.width + PAGE_GAP);
      setView({ zoom, panX: cw / 2 - (pageLeft + doc.width / 2) * zoom, panY: (ch - doc.height * zoom) / 2 + 10 });
    },
    [doc.pages, doc.width, doc.height, selection.pageId]
  );

  const didInitialFit = useRef(false);
  useLayoutEffect(() => {
    if (didInitialFit.current || doc.pages.length === 0) return;
    didInitialFit.current = true;
    fitPage(doc.pages[0].id);
  }, [doc.pages, fitPage]);

  const zoomBy = (factor: number) => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const zoom = Math.min(4, Math.max(0.05, v.zoom * factor));
      const wx = (cx - v.panX) / v.zoom;
      const wy = (cy - v.panY) / v.zoom;
      return { zoom, panX: cx - wx * zoom, panY: cy - wy * zoom };
    });
  };

  // ── Realtime + polling durante a geração ─────────────────────────────────
  const { replace: replaceDoc, docRef } = history;
  const applyRemote = useCallback(
    (row: Partial<StudioCarousel> & { status?: string }) => {
      const nextStatus = (row.status ?? statusRef.current) as StudioStatus;
      const wasBusy = isStudioBusy(statusRef.current);
      setStatus(nextStatus);
      if (row.generation) setGeneration(row.generation as StudioGeneration);
      if (isStudioBusy(nextStatus) || wasBusy) {
        if (row.document && isStudioDocument(row.document) && row.document.pages.length > 0) {
          const firstLoad = docRef.current.pages.length === 0;
          replaceDoc(row.document);
          if (firstLoad) {
            setSelection({ pageId: row.document.pages[0].id, ids: [] });
            didInitialFit.current = false;
          }
        }
        if (typeof row.name === "string") setName(row.name);
        if (row.caption !== undefined) setCaption(row.caption ?? "");
        if (row.brand) setBrand(row.brand as StudioCarousel["brand"]);
        if (wasBusy && nextStatus === "ready") toast.success("Carrossel pronto! Pode editar à vontade.");
        if (wasBusy && nextStatus === "failed") toast.error("A geração falhou. Veja o motivo e tente de novo.");
      }
    },
    [replaceDoc, docRef]
  );

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`studio-${carouselId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "studio_carousels", filter: `id=eq.${carouselId}` },
        (payload) => applyRemote(payload.new as Partial<StudioCarousel>)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [carouselId, applyRemote]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/carousel/studio/${carouselId}`, { cache: "no-store" });
        if (res.ok) applyRemote((await res.json()).carousel);
      } catch {
        // Realtime é o caminho principal; o polling é só rede de segurança.
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [busy, carouselId, applyRemote]);

  // ── Autosave ──────────────────────────────────────────────────────────────
  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/carousel/studio/${carouselId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao salvar");
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        toast.error(e instanceof Error ? e.message : "Falha ao salvar");
      }
    },
    [carouselId]
  );

  useEffect(() => {
    if (history.revision === 0 || busy) return;
    setSaveState("dirty");
    const timer = setTimeout(() => {
      patch({ document: withMeasuredHeights(history.docRef.current, measuredRef.current) });
    }, 1000);
    return () => clearTimeout(timer);
  }, [history.revision, history.docRef, busy, patch]);

  const metaRevision = useRef(0);
  useEffect(() => {
    metaRevision.current += 1;
    if (metaRevision.current === 1 || busy) return;
    setSaveState("dirty");
    const timer = setTimeout(() => patch({ name, caption }), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, caption]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  // ── Inserir camadas ──────────────────────────────────────────────────────
  const insert = useCallback(
    (layer: StudioLayer) => {
      if (!activePage || readOnly) return;
      history.commit((d) => addLayer(d, activePage.id, layer));
      setSelection({ pageId: activePage.id, ids: [layer.id] });
    },
    [activePage, history, readOnly]
  );

  const headingFamily = brand.fontHeading || STUDIO_FONTS.find((f) => f.id === "montserrat")!.family;
  const bodyFamily = brand.fontBody || STUDIO_FONTS.find((f) => f.id === "inter")!.family;
  const roles = useMemo(() => deriveRoles(brand.palette ?? []), [brand.palette]);

  const insertText = () =>
    insert(
      makeTextLayer({
        x: 120,
        y: Math.round(doc.height / 2 - 60),
        width: doc.width - 240,
        fontFamily: headingFamily,
        color: roles.light,
        accentColor: roles.accent,
        text: "Novo texto com *destaque*",
      })
    );
  const insertShape = (shape: "rect" | "ellipse") =>
    insert(
      makeShapeLayer({
        name: shape === "rect" ? "Retângulo" : "Elipse",
        shape,
        x: Math.round(doc.width / 2 - 200),
        y: Math.round(doc.height / 2 - 200),
        fill: roles.accent,
        radius: shape === "rect" ? 24 : 0,
      })
    );
  const insertButton = () =>
    insert(
      makeButtonLayer({
        x: Math.round(doc.width / 2 - 220),
        y: Math.round(doc.height - 300),
        fill: roles.accent,
        color: roles.dark,
        fontFamily: bodyFamily,
      })
    );
  const insertLogo = () => {
    if (!brand.logoUrl) {
      toast.error("A ficha do cliente não tem logo cadastrada.");
      return;
    }
    insert(
      makeImageLayer({
        name: "Logo",
        role: "logo",
        src: brand.logoUrl,
        fit: "contain",
        x: Math.round(doc.width / 2 - 150),
        y: 88,
        width: 300,
        height: 110,
      })
    );
  };

  // ── Imagens (upload + IA) ────────────────────────────────────────────────
  const setBusy = (id: string, on: boolean) =>
    setBusyLayers((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/carousel/studio/${carouselId}/upload`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Falha no upload");
    return data as { url: string; width: number; height: number };
  };

  const addImagesAt = async (pageId: string, files: File[], point: { x: number; y: number }) => {
    for (const [i, file] of files.entries()) {
      const placeholder = makeImageLayer({
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Imagem",
        x: Math.round(point.x - 250 + i * 30),
        y: Math.round(point.y - 250 + i * 30),
        width: 500,
        height: 500,
      });
      history.commit((d) => addLayer(d, pageId, placeholder));
      setSelection({ pageId, ids: [placeholder.id] });
      setBusy(placeholder.id, true);
      try {
        const img = await uploadFile(file);
        const ratio = img.width && img.height ? img.width / img.height : 1;
        const width = ratio >= 1 ? 600 : Math.round(600 * ratio);
        const height = ratio >= 1 ? Math.round(600 / ratio) : 600;
        history.commit((d) =>
          updateLayerAnywhere(d, placeholder.id, {
            src: img.url,
            width,
            height,
            x: Math.round(point.x - width / 2 + i * 30),
            y: Math.round(point.y - height / 2 + i * 30),
          } as Partial<StudioLayer>)
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha no upload");
        history.commit((d) => removeLayers(d, pageId, [placeholder.id]));
      } finally {
        setBusy(placeholder.id, false);
      }
    }
  };

  const callImageApi = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/carousel/studio/${carouselId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Falha na IA");
    return data as { url: string; width: number; height: number };
  };

  /** Ajusta a caixa ao aspecto do recorte, mantendo o centro (elementos). */
  const fitToAspect = (layer: StudioLayer, width: number, height: number): Partial<StudioLayer> => {
    if (!width || !height) return {};
    const ratio = width / height;
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    let w = layer.width;
    let h = w / ratio;
    if (h > layer.height) {
      h = layer.height;
      w = h * ratio;
    }
    return { width: Math.round(w), height: Math.round(h), x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
  };

  const imageActions: ImageActions = {
    replace: (layerId) => {
      replaceTarget.current = layerId;
      replaceInputRef.current?.click();
    },
    generate: async (layerId, prompt, kind) => {
      const found = findLayer(history.docRef.current, layerId);
      if (!found || found.layer.type !== "image") return;
      setBusy(layerId, true);
      try {
        const raw = /NÃO pode conter nenhum texto/.test(prompt);
        const img = await callImageApi({
          mode: "generate",
          kind,
          prompt,
          raw,
          aspectRatio: nearestAspect(found.layer.width, found.layer.height),
        });
        history.commit((d) => {
          const current = findLayer(d, layerId)?.layer;
          if (!current) return d;
          return updateLayerAnywhere(d, layerId, {
            src: img.url,
            prompt,
            status: null,
            error: null,
            ...(kind === "element" ? { role: "element", fit: "contain", ...fitToAspect(current, img.width, img.height) } : {}),
          } as Partial<StudioLayer>);
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao gerar a imagem");
      } finally {
        setBusy(layerId, false);
      }
    },
    edit: async (layerId, instruction) => {
      const found = findLayer(history.docRef.current, layerId);
      if (!found || found.layer.type !== "image" || !found.layer.src) return;
      const kind = found.layer.role === "element" ? "element" : "background";
      setBusy(layerId, true);
      try {
        const img = await callImageApi({
          mode: "edit",
          kind,
          sourceUrl: found.layer.src,
          instruction,
          aspectRatio: nearestAspect(found.layer.width, found.layer.height),
        });
        history.commit((d) => {
          const current = findLayer(d, layerId)?.layer;
          if (!current) return d;
          return updateLayerAnywhere(d, layerId, {
            src: img.url,
            status: null,
            error: null,
            ...(kind === "element" ? fitToAspect(current, img.width, img.height) : {}),
          } as Partial<StudioLayer>);
        });
        toast.success("Edição aplicada (Ctrl+Z desfaz)");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao editar a imagem");
      } finally {
        setBusy(layerId, false);
      }
    },
    cutout: async (layerId) => {
      const found = findLayer(history.docRef.current, layerId);
      if (!found || found.layer.type !== "image" || !found.layer.src) return;
      setBusy(layerId, true);
      try {
        const img = await callImageApi({ mode: "cutout", sourceUrl: found.layer.src });
        history.commit((d) => {
          const current = findLayer(d, layerId)?.layer;
          if (!current) return d;
          return updateLayerAnywhere(d, layerId, {
            src: img.url,
            fit: "contain",
            role: current.type === "image" && current.role === "background" ? "element" : (current as { role?: string }).role,
            ...fitToAspect(current, img.width, img.height),
          } as Partial<StudioLayer>);
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao recortar");
      } finally {
        setBusy(layerId, false);
      }
    },
  };

  const generateNewImage = async (prompt: string, kind: "background" | "element") => {
    if (!activePage) return;
    const layer =
      kind === "background"
        ? makeImageLayer({ name: "Imagem de fundo", role: "background", width: doc.width, height: doc.height, prompt })
        : makeImageLayer({
            name: "Elemento",
            role: "element",
            fit: "contain",
            width: 620,
            height: 620,
            x: Math.round(doc.width / 2 - 310),
            y: Math.round(doc.height / 2 - 310),
            prompt,
          });
    history.commit((d) => addLayer(d, activePage.id, layer, kind === "background" ? 0 : undefined));
    setSelection({ pageId: activePage.id, ids: [layer.id] });
    await imageActions.generate(layer.id, prompt, kind);
  };

  // ── Ações de seleção ─────────────────────────────────────────────────────
  const deleteSelection = useCallback(() => {
    if (!activePage || selection.ids.length === 0 || readOnly) return;
    history.commit((d) => removeLayers(d, activePage.id, selection.ids));
    setSelection({ pageId: activePage.id, ids: [] });
  }, [activePage, selection.ids, history, readOnly]);

  const duplicateSelection = useCallback(() => {
    if (!activePage || selection.ids.length === 0 || readOnly) return;
    let newIds: string[] = [];
    history.commit((d) => {
      const result = duplicateLayers(d, activePage.id, selection.ids);
      newIds = result.newIds;
      return result.doc;
    });
    setTimeout(() => setSelection({ pageId: activePage.id, ids: newIds }), 0);
  }, [activePage, selection.ids, history, readOnly]);

  const onAddPage = () => {
    const page = makePage({ name: `Página ${doc.pages.length + 1}`, background: roles.dark });
    const index = activePage ? doc.pages.findIndex((p) => p.id === activePage.id) + 1 : doc.pages.length;
    history.commit((d) => addPage(d, page, index));
    setSelection({ pageId: page.id, ids: [] });
    setTimeout(() => fitPage(page.id), 0);
  };
  const onDuplicatePage = (pageId: string) => {
    let newId: string | null = null;
    history.commit((d) => {
      const r = duplicatePage(d, pageId);
      newId = r.newId;
      return r.doc;
    });
    setTimeout(() => newId && setSelection({ pageId: newId, ids: [] }), 0);
  };
  const onDeletePage = (pageId: string) => {
    if (doc.pages.length <= 1) return;
    history.commit((d) => removePage(d, pageId));
  };

  // ── Teclado ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }
      if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        zoomBy(1.2);
        return;
      }
      if (mod && key === "-") {
        e.preventDefault();
        zoomBy(1 / 1.2);
        return;
      }
      if (e.shiftKey && (e.code === "Digit1" || key === "!")) {
        e.preventDefault();
        fitPage();
        return;
      }
      if (e.shiftKey && (e.code === "Digit2" || key === "@")) {
        e.preventDefault();
        fitPage(null, true);
        return;
      }
      if (readOnly) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        history.redo();
        return;
      }
      if (e.key === "Escape") {
        if (cropId) setCropId(null);
        else setSelection((s) => ({ pageId: s.pageId, ids: [] }));
        return;
      }
      if (!activePage) return;
      if (mod && key === "a") {
        e.preventDefault();
        setSelection({ pageId: activePage.id, ids: activePage.layers.filter((l) => !l.locked && !l.hidden).map((l) => l.id) });
        return;
      }
      if (mod && key === "c" && selectedLayers.length) {
        clipboard.current = selectedLayers.map((l) => structuredClone(l));
        return;
      }
      if (mod && key === "v" && clipboard.current.length) {
        e.preventDefault();
        const copies = clipboard.current.map((l) => cloneLayer(l, 24));
        clipboard.current = copies.map((l) => structuredClone(l));
        history.commit((d) => copies.reduce((acc, l) => addLayer(acc, activePage.id, l), d));
        setSelection({ pageId: activePage.id, ids: copies.map((l) => l.id) });
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && (e.key === "]" || e.key === "[" || e.code === "BracketRight" || e.code === "BracketLeft")) {
        e.preventDefault();
        const forward = e.key === "]" || e.code === "BracketRight";
        const move = forward ? (e.shiftKey ? "front" : "forward") : e.shiftKey ? "back" : "backward";
        if (selection.ids.length) history.commit((d) => reorderLayers(d, activePage.id, selection.ids, move));
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key.startsWith("Arrow") && selection.ids.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        history.commit(
          (d) => updateLayers(d, activePage.id, selection.ids, (l) => (l.locked ? {} : { x: l.x + dx, y: l.y + dy })),
          "nudge"
        );
        return;
      }
      if (!mod && !e.altKey) {
        if (key === "t") insertText();
        else if (key === "r") insertShape("rect");
        else if (key === "o") insertShape("ellipse");
        else if (key === "b") insertButton();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  // ── Geração ───────────────────────────────────────────────────────────────
  const regenerate = async (nextBrief: string) => {
    const res = await fetch(`/api/carousel/studio/${carouselId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: nextBrief }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Não foi possível iniciar a geração");
      return;
    }
    setBrief(nextBrief);
    setStatus("queued");
    setGeneration({ stage: "queued", message: "Na fila…" });
    setSelection((s) => ({ pageId: s.pageId, ids: [] }));
    toast.success("Gerando… acompanhe o progresso aqui mesmo.");
  };

  // ── Exportação ────────────────────────────────────────────────────────────
  const runExport = async (mode: "download-one" | "download-all" | "demand") => {
    const pending = doc.pages.flatMap((p) => p.layers).filter((l) => l.type === "image" && !l.hidden && !l.src);
    if (pending.length) toast.warning(`${pending.length} imagem(ns) sem conteúdo serão exportadas vazias.`);
    setSelection((s) => ({ pageId: s.pageId, ids: [] }));
    setEditingTextId(null);
    setCropId(null);
    setExporting(mode);
    await new Promise((r) => setTimeout(r, 120));
    try {
      const pages = mode === "download-one" && activePage ? [activePage] : doc.pages;
      for (const page of pages) {
        const node = exportRefs.current.get(page.id);
        if (!node) throw new Error("Página não renderizada para exportação");
        const blob = await renderFrameToBlob(node, doc.width, doc.height);
        const index = doc.pages.findIndex((p) => p.id === page.id) + 1;
        if (mode === "demand" && initial.demand_id) {
          await uploadPageToDemand({ demandId: initial.demand_id, index, blob });
        } else {
          const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "carrossel";
          downloadBlob(blob, `${slug}-${String(index).padStart(2, "0")}.png`);
          if (pages.length > 1) await new Promise((r) => setTimeout(r, 350));
        }
      }
      toast.success(
        mode === "demand"
          ? `${pages.length} páginas enviadas para a entrega da demanda`
          : `${pages.length} PNG${pages.length > 1 ? "s" : ""} baixado${pages.length > 1 ? "s" : ""}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na exportação");
    } finally {
      setExporting(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const progress = generation.total ? Math.round(((generation.done ?? 0) / generation.total) * 100) : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#141417] text-white">
      {/* Barra superior */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#18181c] px-2">
        <Link href={backHref} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-white/60 hover:bg-white/10 hover:text-white" title={`Voltar para ${backLabel}`}>
          <ArrowLeft className="size-4" />
          <span className="hidden lg:inline">{backLabel}</span>
        </Link>
        <span className="h-5 w-px bg-white/10" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-56 min-w-0 rounded-md bg-transparent px-2 text-sm font-semibold text-white outline-none hover:bg-white/[0.06] focus:bg-white/[0.08]"
        />
        <span className="flex items-center gap-1 text-[11px] text-white/40" title="Salvamento automático">
          {busy ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Gerando
            </>
          ) : saveState === "saving" ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Salvando
            </>
          ) : saveState === "error" ? (
            <>
              <CloudOff className="size-3 text-red-400" /> Erro ao salvar
            </>
          ) : saveState === "dirty" ? (
            <>
              <Circle className="size-2 fill-amber-400 text-amber-400" /> Alterado
            </>
          ) : (
            <>
              <Check className="size-3" /> Salvo
            </>
          )}
        </span>

        <div className="mx-auto flex items-center gap-0.5">
          <ToolButton title="Texto (T)" onClick={insertText} disabled={readOnly}>
            <Type className="size-4" /> <span className="hidden xl:inline">Texto</span>
          </ToolButton>
          <ToolButton title="Retângulo (R)" onClick={() => insertShape("rect")} disabled={readOnly}>
            <Square className="size-4" />
          </ToolButton>
          <ToolButton title="Elipse (O)" onClick={() => insertShape("ellipse")} disabled={readOnly}>
            <Circle className="size-4" />
          </ToolButton>
          <ToolButton title="Botão (B)" onClick={insertButton} disabled={readOnly}>
            <MousePointerClick className="size-4" /> <span className="hidden xl:inline">Botão</span>
          </ToolButton>
          <ToolButton title="Imagem do computador" onClick={() => addImageInputRef.current?.click()} disabled={readOnly}>
            <ImagePlus className="size-4" /> <span className="hidden xl:inline">Imagem</span>
          </ToolButton>
          <ToolButton title="Gerar imagem/elemento com IA" onClick={() => setDialogs((d) => ({ ...d, ai: true }))} disabled={readOnly}>
            <Wand2 className="size-4" /> <span className="hidden xl:inline">Elemento IA</span>
          </ToolButton>
          <ToolButton title="Logo do cliente" onClick={insertLogo} disabled={readOnly}>
            <Stamp className="size-4" /> <span className="hidden xl:inline">Logo</span>
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <ToolButton title="Desfazer (Ctrl+Z)" onClick={history.undo} disabled={!history.canUndo || readOnly}>
            <Undo2 className="size-4" />
          </ToolButton>
          <ToolButton title="Refazer (Ctrl+Shift+Z)" onClick={history.redo} disabled={!history.canRedo || readOnly}>
            <Redo2 className="size-4" />
          </ToolButton>
        </div>

        <div className="flex items-center gap-0.5">
          <ToolButton title="Diminuir zoom (Ctrl -)" onClick={() => zoomBy(1 / 1.2)}>
            <Minus className="size-3.5" />
          </ToolButton>
          <button
            type="button"
            title="Ajustar à tela (Shift+1) · ver todas (Shift+2)"
            onClick={() => fitPage()}
            className="h-8 w-14 rounded-md text-xs text-white/70 tabular-nums hover:bg-white/10"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <ToolButton title="Aumentar zoom (Ctrl +)" onClick={() => zoomBy(1.2)}>
            <Plus className="size-3.5" />
          </ToolButton>
          <ToolButton title="Ver todas as páginas (Shift+2)" onClick={() => fitPage(null, true)}>
            <Maximize2 className="size-3.5" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <ToolButton title="Referências visuais" onClick={() => setDialogs((d) => ({ ...d, references: true }))}>
            <Images className="size-4" /> <span className="hidden lg:inline">Referências</span>
          </ToolButton>
          <ToolButton title="Gerar o carrossel de novo com IA" onClick={() => setDialogs((d) => ({ ...d, regenerate: true }))} disabled={busy}>
            <Sparkles className="size-4" /> <span className="hidden lg:inline">Gerar de novo</span>
          </ToolButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={readOnly || doc.pages.length === 0}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-500 px-3 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
            >
              {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              Exportar
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => runExport("download-all")}>
                <Download /> Baixar todas as páginas (PNG)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport("download-one")}>
                <Download /> Baixar página atual (PNG)
              </DropdownMenuItem>
              {initial.demand_id ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => runExport("demand")}>
                    <Send /> Enviar para a entrega da demanda
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 border-r border-white/[0.07] bg-[#18181c]">
          <LayersPanel
            history={history}
            selection={selection}
            setSelection={setSelection}
            onFocusPage={(id) => fitPage(id)}
            onAddPage={onAddPage}
            onDuplicatePage={onDuplicatePage}
            onDeletePage={onDeletePage}
            onMovePage={(id, dir) => history.commit((d) => movePage(d, id, dir))}
            readOnly={readOnly}
          />
        </aside>

        <main ref={canvasWrapRef} className="relative min-w-0 flex-1">
          {doc.pages.length > 0 ? (
            <StudioCanvas
              history={history}
              selection={selection}
              setSelection={setSelection}
              view={view}
              setView={setView}
              editingTextId={editingTextId}
              setEditingTextId={setEditingTextId}
              cropId={cropId}
              setCropId={setCropId}
              busyLayers={busyLayers}
              readOnly={readOnly}
              measured={measured}
              setMeasured={setMeasured}
              spacePressed={spacePressed}
              onDropFiles={addImagesAt}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              {busy ? (
                <Loader2 className="size-8 animate-spin text-indigo-300" />
              ) : (
                <Sparkles className="size-8 text-indigo-300" />
              )}
              <p className="max-w-sm text-sm text-white/60">
                {busy
                  ? generation.message ?? "Preparando…"
                  : status === "failed"
                    ? `A geração falhou: ${generation.error ?? "erro desconhecido"}`
                    : "Este carrossel ainda não foi gerado."}
              </p>
              {!busy ? (
                <button
                  type="button"
                  onClick={() => setDialogs((d) => ({ ...d, regenerate: true }))}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold hover:bg-indigo-400"
                >
                  <Sparkles className="size-4" /> Gerar com IA
                </button>
              ) : null}
            </div>
          )}

          {busy && doc.pages.length > 0 ? (
            <div className="pointer-events-none absolute top-3 left-1/2 w-[min(460px,90%)] -translate-x-1/2 rounded-xl border border-white/10 bg-[#1d1d23]/95 px-4 py-3 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="size-4 animate-spin text-indigo-300" />
                {generation.message ?? "Gerando…"}
              </div>
              {progress !== null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
          {!busy && generation.error && status === "ready" ? (
            <div className="absolute bottom-3 left-1/2 max-w-lg -translate-x-1/2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
              {generation.error}
            </div>
          ) : null}
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/[0.07] bg-[#18181c]">
          <PropertiesPanel
            history={history}
            page={activePage}
            layers={selectedLayers}
            palette={palette}
            measured={measured}
            busy={busyLayers}
            readOnly={readOnly}
            caption={caption}
            onCaptionChange={setCaption}
            imageActions={imageActions}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onDuplicatePage={() => activePage && onDuplicatePage(activePage.id)}
            onDeletePage={() => activePage && onDeletePage(activePage.id)}
          />
        </aside>
      </div>

      {/* Inputs escondidos de upload */}
      <input
        ref={addImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (activePage && files.length) addImagesAt(activePage.id, files, { x: doc.width / 2, y: doc.height / 2 });
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const layerId = replaceTarget.current;
          if (!file || !layerId) return;
          setBusy(layerId, true);
          try {
            const img = await uploadFile(file);
            history.commit((d) => updateLayerAnywhere(d, layerId, { src: img.url, status: null, error: null, focusX: 50, focusY: 50, zoom: 1 } as Partial<StudioLayer>));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha no upload");
          } finally {
            setBusy(layerId, false);
          }
        }}
      />

      {/* Páginas fora da tela para exportar em tamanho real */}
      {exporting ? (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          {doc.pages.map((page) => (
            <div
              key={page.id}
              ref={(el) => {
                if (el) exportRefs.current.set(page.id, el);
                else exportRefs.current.delete(page.id);
              }}
              style={{ width: doc.width, height: doc.height }}
            >
              <FrameRenderer page={withMeasuredHeights({ ...doc, pages: [page] }, measured).pages[0]} width={doc.width} height={doc.height} exporting />
            </div>
          ))}
        </div>
      ) : null}

      <RegenerateDialog
        key={dialogs.regenerate ? "open" : "closed"}
        open={dialogs.regenerate}
        onOpenChange={(open) => setDialogs((d) => ({ ...d, regenerate: open }))}
        initialBrief={brief}
        onConfirm={regenerate}
      />
      <ReferencesDialog
        open={dialogs.references}
        onOpenChange={(open) => setDialogs((d) => ({ ...d, references: open }))}
        carouselId={carouselId}
        brandReferences={brand.referenceUrls ?? []}
        demandReferences={demandReferenceUrls}
        extraReferences={extraRefs}
        onExtraChange={setExtraRefs}
      />
      <AiImageDialog
        open={dialogs.ai}
        onOpenChange={(open) => setDialogs((d) => ({ ...d, ai: open }))}
        onGenerate={generateNewImage}
      />
    </div>
  );
}

