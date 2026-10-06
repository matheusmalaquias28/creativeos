"use client";

import { Handle, Position, useEdges, useReactFlow } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { ListChecks, ImageIcon, Eraser } from "lucide-react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { NodeThumb } from "@/components/flow/nodes/node-image";
import { cn } from "@/lib/utils";
import type {
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
  const { scheduleAutoSave } = useFlowCanvas();
  const items = useListItems(id, data);
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

  function clearAll() {
    patchSelf(() => ({ items: [], itemSources: {} }));
    setEdges((es) => es.filter((e) => e.target !== id));
  }

  return (
    <NodeShell
      tone={FLOW_NODE_TONE.listaImagens}
      icon={ListChecks}
      title={data.label || "Lista"}
      selected={selected}
      className="w-72"
      meta={
        items.length > 0 && (
          <div className="flex items-center gap-1">
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
          </div>
        )
      }
    >
      <Handle type="target" position={Position.Left} className={flowHandleClass} />

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
        <NodeImagePlaceholder icon={ImageIcon} className="aspect-video">
          <span className="text-[0.625rem] text-muted-foreground">Conecte imagens</span>
        </NodeImagePlaceholder>
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
