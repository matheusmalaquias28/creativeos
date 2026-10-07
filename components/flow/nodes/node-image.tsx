"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUpRight, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadImageUrl, imageFilename } from "@/lib/flow/download-image";

/** Lightbox simples (portal) — duplo-clique numa imagem do canvas abre aqui. */
export function ImageLightbox({
  url,
  onClose,
  filename,
}: {
  url: string;
  onClose: () => void;
  /** Nome do arquivo ao baixar (padrão: nome do arquivo na URL). */
  filename?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="nodrag nopan nowheel fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          title="Baixar imagem"
          className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            const base = url.split("?")[0].split("/").pop()?.replace(/\.[^.]+$/, "") || "imagem";
            void downloadImageUrl(url, filename ?? imageFilename(base, url));
          }}
        >
          <Download className="size-4" />
        </button>
        <button
          type="button"
          title="Fechar"
          className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

/**
 * Thumbnail dentro de uma lista (clienteReferencias / listaImagens): maior,
 * lightbox no duplo-clique e, no hover, uma seta que "joga a imagem para fora"
 * e uma lixeira que remove a imagem da lista.
 */
export function NodeThumb({
  url,
  onPopOut,
  onRemove,
  alt,
}: {
  url: string;
  onPopOut?: () => void;
  onRemove?: () => void;
  alt?: string;
}) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <div className="group/thumb relative aspect-square overflow-hidden rounded-lg border border-border bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt ?? ""}
        draggable={false}
        onDoubleClick={() => setLightbox(true)}
        title="Duplo-clique para ampliar"
        className="nodrag size-full cursor-zoom-in object-cover"
      />
      {onPopOut && (
        <button
          type="button"
          onClick={onPopOut}
          title="Tirar da lista"
          className="nodrag absolute right-1 top-1 flex size-5 items-center justify-center rounded-md border border-border bg-card/85 text-foreground opacity-0 backdrop-blur transition-premium hover:bg-primary hover:text-primary-foreground group-hover/thumb:opacity-100"
        >
          <ArrowUpRight className="size-3" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remover da lista"
          className="nodrag absolute left-1 top-1 flex size-5 items-center justify-center rounded-md border border-border bg-card/85 text-foreground opacity-0 backdrop-blur transition-premium hover:bg-tone-red hover:text-white group-hover/thumb:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      {lightbox && <ImageLightbox url={url} onClose={() => setLightbox(false)} />}
    </div>
  );
}

/**
 * Imagem "crua" de um node do canvas: sem card, no aspect original, com nome
 * editável (duplo-clique) embaixo e lightbox (duplo-clique na imagem). O Handle
 * fica a cargo do node que usa este componente.
 */
export function NodeImage({
  url,
  name,
  alt,
  onRename,
  onDownload,
  selected,
  className,
}: {
  url: string | null;
  name: string;
  alt?: string;
  onRename?: (name: string) => void;
  /** Mostra o botão de baixar no hover da imagem. */
  onDownload?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const [lightbox, setLightbox] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commitName() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename?.(next);
    else setDraft(name);
  }

  return (
    <div className={cn("flex w-40 flex-col items-center gap-1", className)}>
      {url ? (
        <div className="group/img relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt ?? name}
          draggable={false}
          onDoubleClick={() => setLightbox(true)}
          title="Arraste para mover · duplo-clique para ampliar"
          className={cn(
            "max-h-48 w-full cursor-grab rounded-lg object-contain transition-premium active:cursor-grabbing",
            selected ? "ring-2 ring-primary/60" : "ring-1 ring-border"
          )}
        />
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            title="Baixar imagem"
            className="nodrag absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md border border-border bg-card/85 text-foreground opacity-0 backdrop-blur transition-premium hover:bg-primary hover:text-primary-foreground group-hover/img:opacity-100"
          >
            <Download className="size-3.5" />
          </button>
        )}
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface text-[0.625rem] text-muted-foreground">
          sem imagem
        </div>
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="nodrag w-full rounded-md border border-primary/60 bg-input px-1.5 py-0.5 text-center text-[0.6875rem] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      ) : (
        <span
          onDoubleClick={() => onRename && setEditing(true)}
          title={onRename ? "Duplo-clique para renomear" : undefined}
          className={cn(
            "max-w-full truncate text-[0.6875rem] font-medium text-foreground",
            onRename && "nodrag cursor-text"
          )}
        >
          {name}
        </span>
      )}

      {lightbox && url && (
        <ImageLightbox url={url} filename={imageFilename(name, url)} onClose={() => setLightbox(false)} />
      )}
    </div>
  );
}
