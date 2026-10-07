"use client";

import { useRef, useState } from "react";
import { Handle, Position, useEdges, useReactFlow } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { ListChecks, ImageIcon, Eraser, Upload, Loader2, FolderUp } from "lucide-react";
import { toast } from "sonner";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { NodeThumb } from "@/components/flow/nodes/node-image";
import { SendListToDriveDialog } from "@/components/flow/send-list-to-drive-dialog";
import { cn } from "@/lib/utils";
import type {
  ArteData,
  ClienteReferenciasData,
  ListaImagensData,
  ReferenciaImagemData,
} from "@/lib/flow/types";

type Props = { id: string; data: ListaImagensData; selected?: boolean };

/**
 * Item exibido na lista. `materialized` = imagem gerada guardada em `data.items`
 * (persistida); senão vem ao vivo de um node estático conectado (imagem, logo,
 * refs). É exatamente o conjunto que o servidor usa (ver collectListItems).
 */
type ListItem = { url: string; sourceId: string | null; materialized: boolean };

function useListItems(id: string, data: ListaImagensData): ListItem[] {
  const edges = useEdges();
  const { getNode } = useReactFlow();
  const out: ListItem[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined, sourceId: string | null, materialized: boolean) => {
    if (!url?.trim() || seen.has(url)) return;
    seen.add(url);
    out.push({ url, sourceId, materialized });
  };

  for (const url of data.items ?? []) push(url, data.itemSources?.[url] ?? null, true);

  for (const edge of edges) {
    if (edge.target !== id) continue;
    const node = getNode(edge.source);
    if (!node) continue;
    if (node.type === "referenciaImagem") push((node.data as ReferenciaImagemData).imageUrl, edge.source, false);
    else if (node.type === "clienteReferencias")
      (node.data as ClienteReferenciasData).referenceUrls?.forEach((u) => push(u, edge.source, false));
    else if (node.type === "clienteLogo")
      push((node.data as { logoUrl?: string | null }).logoUrl, edge.source, false);
  }
  return out;
}

export function ListaImagensNode({ id, data, selected }: Props) {
  const { setNodes, setEdges, getNode } = useReactFlow();
  const { scheduleAutoSave, demandId } = useFlowCanvas();
  const items = useListItems(id, data);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  // URLs congeladas ao abrir o diálogo do Drive (null = fechado).
  const [driveUrls, setDriveUrls] = useState<string[] | null>(null);
  // Lista alimentada por um node de stories → o Drive abre na pasta Stories.
  const isStoryList = items.some((item) => {
    const src = item.sourceId ? getNode(item.sourceId) : undefined;
    return src?.type === "arte" && (src.data as ArteData).format === "story";
  });
  const mode = data.mode ?? "reference";

  function patchSelf(fn: (d: ListaImagensData) => Partial<ListaImagensData>) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...fn(n.data as ListaImagensData) } } : n
      )
    );
    scheduleAutoSave();
  }

  function setMode(next: "reference" | "list") {
    patchSelf(() => ({ mode: next }));
  }

  function dropMaterialized(url: string) {
    patchSelf((d) => {
      const { [url]: _drop, ...itemSources } = d.itemSources ?? {};
      return { items: (d.items ?? []).filter((u) => u !== url), itemSources };
    });
  }

  // Remove o item: gerado → sai da lista; estático → desconecta a origem.
  function remove(item: ListItem) {
    if (item.materialized) {
      dropMaterialized(item.url);
      return;
    }
    if (item.sourceId) {
      setEdges((es) => es.filter((e) => !(e.target === id && e.source === item.sourceId)));
      scheduleAutoSave();
    }
  }

  // "Joga para fora": vira um node de imagem solto ao lado (e sai da lista).
  function popOut(item: ListItem, index: number) {
    if (!item.materialized) {
      remove(item);
      return;
    }
    const self = getNode(id);
    const imageNode: Node = {
      id: `referenciaImagem-${Date.now()}`,
      type: "referenciaImagem",
      position: self
        ? { x: self.position.x + 280, y: self.position.y + index * 48 }
        : { x: 0, y: 0 },
      data: { imageUrl: item.url, label: "Imagem" } satisfies ReferenciaImagemData,
    };
    setNodes((ns) => [...ns, imageNode]);
    dropMaterialized(item.url);
  }

  // Envia arquivos do computador: sobem pro Storage (o grafo guarda só a URL)
  // e entram como itens da lista — mesmo caminho das imagens materializadas,
  // então valem no fan-out e na referência, e podem ser removidos/soltos.
  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    if (!demandId) {
      toast.error("Abra o canvas de uma demanda para enviar imagens");
      return;
    }
    setUploading((n) => n + files.length);
    await Promise.all(
      files.map(async (file) => {
        try {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch(`/api/demands/${demandId}/flow/upload`, { method: "POST", body });
          const json = (await res.json()) as { url?: string; error?: string };
          if (!res.ok || !json.url) throw new Error(json.error ?? "Falha no upload");
          const url = json.url;
          patchSelf((d) => ({ items: [...(d.items ?? []).filter((u) => u !== url), url] }));
        } catch (err) {
          toast.error("Erro ao enviar imagem", {
            description: err instanceof Error ? err.message : String(err),
          });
        } finally {
          setUploading((n) => n - 1);
        }
      })
    );
  }

  // Arquivo solto em cima da lista entra nela (e não vira node solto no canvas).
  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function onDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    void uploadFiles(e.dataTransfer.files);
  }

  function clearAll() {
    patchSelf(() => ({ items: [], itemSources: {} }));
    setEdges((es) => es.filter((e) => e.target !== id));
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDragOver(false);
      }}
      onDrop={onDrop}
    >
    <NodeShell
      tone={FLOW_NODE_TONE.listaImagens}
      icon={ListChecks}
      title={data.label || "Lista"}
      selected={selected}
      className={cn("w-72", dragOver && "ring-2 ring-primary")}
      meta={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading > 0}
            title="Enviar imagens do computador para a lista"
            className="nodrag flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            {uploading > 0 ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
          </button>
          {items.length > 0 && demandId && (
            <button
              type="button"
              onClick={() => setDriveUrls(items.map((item) => item.url))}
              title="Enviar as imagens da lista para o Drive da demanda"
              className="nodrag flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FolderUp className="size-3" />
            </button>
          )}
          {items.length > 0 && (
            <>
            <span className="rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-muted-foreground">
              {items.length}
            </span>
            <button
              type="button"
              onClick={clearAll}
              title="Limpar lista (remove todos os itens e conexões)"
              className="nodrag flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tone-red/10 hover:text-tone-red"
            >
              <Eraser className="size-3" />
            </button>
            </>
          )}
        </div>
      }
    >
      <Handle type="target" position={Position.Left} className={flowHandleClass} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Modo: referência (1 geração) vs lista (fan-out, 1 por item) */}
      <div className="mb-2 flex overflow-hidden rounded-lg border border-border">
        {(["reference", "list"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "nodrag flex-1 px-2 py-1 text-[0.625rem] font-semibold transition-premium",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
            title={
              m === "reference"
                ? "Usar todas as imagens como referência de 1 geração"
                : "Fan-out: gerar 1 imagem por item da lista"
            }
          >
            {m === "reference" ? "Referência" : "Lista"}
          </button>
        ))}
      </div>

      {items.length > 0 ? (
        <>
          <div className="nowheel grid max-h-96 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
            {items.map((item, i) => (
              <NodeThumb
                key={`${item.url}-${i}`}
                url={item.url}
                alt={`Item ${i + 1}`}
                onPopOut={() => popOut(item, i)}
                onRemove={() => remove(item)}
              />
            ))}
          </div>
          <p className="mt-2 text-[0.625rem] text-muted-foreground">
            {mode === "list"
              ? `Gera ${items.length} ${items.length === 1 ? "imagem" : "imagens"} — 1 por item`
              : `${items.length} ${items.length === 1 ? "imagem entra" : "imagens entram"} como referência`}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="nodrag block w-full"
        >
          <NodeImagePlaceholder icon={uploading > 0 ? Loader2 : ImageIcon} className="aspect-video">
            <span className="text-[0.625rem] text-muted-foreground">
              {uploading > 0 ? "Enviando…" : "Conecte, arraste ou clique para enviar imagens"}
            </span>
          </NodeImagePlaceholder>
        </button>
      )}
      {uploading > 0 && items.length > 0 && (
        <p className="mt-1 text-[0.625rem] text-muted-foreground">
          Enviando {uploading} {uploading === 1 ? "imagem" : "imagens"}…
        </p>
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />

      {driveUrls && demandId && (
        <SendListToDriveDialog
          demandId={demandId}
          urls={driveUrls}
          defaultFormat={isStoryList ? "story" : "feed"}
          onClose={() => setDriveUrls(null)}
        />
      )}
    </NodeShell>
    </div>
  );
}
