"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  MousePointerClick,
  Plus,
  Square,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { moveLayerTo, updateLayers } from "@/lib/carousel-studio/doc-ops";
import type { StudioLayer, StudioPage } from "@/types/carousel-studio";
import { FrameThumbnail } from "./frame-renderer";
import type { StudioHistory } from "./use-studio-history";
import type { Selection } from "./studio-canvas";

function LayerIcon({ layer }: { layer: StudioLayer }) {
  const cls = "size-3.5 shrink-0 text-white/45";
  if (layer.type === "text") return <Type className={cls} />;
  if (layer.type === "image") return <ImageIcon className={cls} />;
  if (layer.type === "button") return <MousePointerClick className={cls} />;
  return <Square className={cls} />;
}

type Props = {
  history: StudioHistory;
  selection: Selection;
  setSelection: (s: Selection) => void;
  onFocusPage: (pageId: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onMovePage: (pageId: string, dir: -1 | 1) => void;
  readOnly: boolean;
};

export function LayersPanel(props: Props) {
  const { history, selection, setSelection, onFocusPage, readOnly } = props;
  const doc = history.doc;
  const activePage = doc.pages.find((p) => p.id === selection.pageId) ?? doc.pages[0] ?? null;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const toggle = (page: StudioPage, layer: StudioLayer, key: "hidden" | "locked") =>
    history.commit((d) => updateLayers(d, page.id, [layer.id], (l) => ({ [key]: !l[key] })));

  const reversed = activePage ? [...activePage.layers].reverse() : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Páginas</h3>
        {!readOnly ? (
          <button type="button" title="Nova página" onClick={props.onAddPage} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="max-h-[42%] shrink-0 space-y-2 overflow-y-auto px-3 pb-3">
        {doc.pages.map((page, i) => {
          const active = page.id === activePage?.id;
          return (
            <div
              key={page.id}
              className={cn(
                "group flex cursor-pointer gap-2 rounded-lg p-1.5 transition-colors",
                active ? "bg-indigo-500/15 ring-1 ring-indigo-400/50" : "hover:bg-white/[0.05]"
              )}
              onClick={() => {
                setSelection({ pageId: page.id, ids: [] });
                onFocusPage(page.id);
              }}
            >
              <span className="w-4 pt-0.5 text-[10px] font-semibold text-white/40 tabular-nums">{i + 1}</span>
              <FrameThumbnail page={page} width={doc.width} height={doc.height} displayWidth={64} className="shrink-0 rounded-sm ring-1 ring-white/10" />
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <span className="truncate text-xs text-white/80">{page.name}</span>
                {!readOnly ? (
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" title="Mover para trás" onClick={(e) => { e.stopPropagation(); props.onMovePage(page.id, -1); }} className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"><ChevronLeft className="size-3" /></button>
                    <button type="button" title="Mover para frente" onClick={(e) => { e.stopPropagation(); props.onMovePage(page.id, 1); }} className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"><ChevronRight className="size-3" /></button>
                    <button type="button" title="Duplicar página" onClick={(e) => { e.stopPropagation(); props.onDuplicatePage(page.id); }} className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"><Copy className="size-3" /></button>
                    <button type="button" title="Excluir página" disabled={doc.pages.length <= 1} onClick={(e) => { e.stopPropagation(); props.onDeletePage(page.id); }} className="rounded p-0.5 text-white/50 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-30"><Trash2 className="size-3" /></button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/[0.06] px-3 pt-3 pb-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">Camadas</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {activePage && reversed.length === 0 ? <p className="px-2 text-xs text-white/35">Página vazia.</p> : null}
        {activePage
          ? reversed.map((layer, ri) => {
              const index = activePage.layers.length - 1 - ri;
              const selected = selection.pageId === activePage.id && selection.ids.includes(layer.id);
              return (
                <div
                  key={layer.id}
                  draggable={!readOnly && renaming !== layer.id}
                  onDragStart={(e) => {
                    setDragId(layer.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const above = e.clientY < rect.top + rect.height / 2;
                    // Lista invertida: "acima" na lista = mais à frente no array.
                    setDropIndex(above ? index + 1 : index);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId && dropIndex !== null) {
                      const from = activePage.layers.findIndex((l) => l.id === dragId);
                      const to = from < dropIndex ? dropIndex - 1 : dropIndex;
                      history.commit((d) => moveLayerTo(d, activePage.id, dragId, to));
                    }
                    setDragId(null);
                    setDropIndex(null);
                  }}
                  onClick={(e) => {
                    if (e.shiftKey && selection.pageId === activePage.id) {
                      setSelection({
                        pageId: activePage.id,
                        ids: selected ? selection.ids.filter((id) => id !== layer.id) : [...selection.ids, layer.id],
                      });
                    } else {
                      setSelection({ pageId: activePage.id, ids: [layer.id] });
                    }
                  }}
                  onDoubleClick={() => !readOnly && setRenaming(layer.id)}
                  className={cn(
                    "group relative flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-xs",
                    selected ? "bg-indigo-500/20 text-white" : "text-white/70 hover:bg-white/[0.05]",
                    layer.hidden && "opacity-45",
                    dragId === layer.id && "opacity-40"
                  )}
                >
                  {dropIndex !== null && dragId && dropIndex === index + 1 ? (
                    <span className="absolute inset-x-1 top-0 h-0.5 rounded bg-indigo-400" />
                  ) : null}
                  {dropIndex !== null && dragId && dropIndex === index ? (
                    <span className="absolute inset-x-1 bottom-0 h-0.5 rounded bg-indigo-400" />
                  ) : null}
                  <LayerIcon layer={layer} />
                  {renaming === layer.id ? (
                    <input
                      autoFocus
                      defaultValue={layer.name}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                      }}
                      onBlur={(e) => {
                        const name = e.target.value.trim() || layer.name;
                        history.commit((d) => updateLayers(d, activePage.id, [layer.id], () => ({ name })));
                        setRenaming(null);
                      }}
                      className="h-6 min-w-0 flex-1 rounded bg-white/10 px-1.5 text-xs text-white outline-none"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{layer.name}</span>
                  )}
                  {!readOnly ? (
                    <span className={cn("flex gap-0.5", !layer.locked && !layer.hidden && "opacity-0 group-hover:opacity-100")}>
                      <button type="button" title={layer.locked ? "Destravar" : "Travar"} onClick={(e) => { e.stopPropagation(); toggle(activePage, layer, "locked"); }} className="rounded p-0.5 hover:bg-white/10">
                        {layer.locked ? <Lock className="size-3 text-amber-300" /> : <Unlock className="size-3" />}
                      </button>
                      <button type="button" title={layer.hidden ? "Mostrar" : "Ocultar"} onClick={(e) => { e.stopPropagation(); toggle(activePage, layer, "hidden"); }} className="rounded p-0.5 hover:bg-white/10">
                        {layer.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}
