"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Layers, ImageIcon } from "lucide-react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { NodeThumb } from "@/components/flow/nodes/node-image";
import type { ClienteReferenciasData, ReferenciaImagemData } from "@/lib/flow/types";
import type { Node } from "@xyflow/react";

export function ClienteReferenciasNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: ClienteReferenciasData;
  selected?: boolean;
}) {
  const { setNodes, getNode } = useReactFlow();
  const { scheduleAutoSave } = useFlowCanvas();
  const refs = data.referenceUrls ?? [];

  // Tira a URL do node e lembra a remoção — o perfil não a devolve no enrich.
  function withoutUrl(n: Node, url: string, index: number): Node {
    const d = n.data as ClienteReferenciasData;
    return {
      ...n,
      data: {
        ...d,
        referenceUrls: (d.referenceUrls ?? []).filter((_, i) => i !== index),
        removedUrls: Array.from(new Set([...(d.removedUrls ?? []), url])),
      },
    };
  }

  function remove(url: string, index: number) {
    setNodes((ns) => ns.map((n) => (n.id === id ? withoutUrl(n, url, index) : n)));
    scheduleAutoSave();
  }

  // "Joga para fora": remove a URL da lista e cria um node de imagem solto ao lado.
  function popOut(url: string, index: number) {
    const self = getNode(id);
    const pos = self
      ? { x: self.position.x + 240, y: self.position.y + index * 48 }
      : { x: 0, y: 0 };
    const newNode: Node = {
      id: `referenciaImagem-${Date.now()}`,
      type: "referenciaImagem",
      position: pos,
      data: { imageUrl: url, label: "Imagem" } as ReferenciaImagemData,
    };
    setNodes((ns) => [...ns.map((n) => (n.id === id ? withoutUrl(n, url, index) : n)), newNode]);
    scheduleAutoSave();
  }

  return (
    <NodeShell
      tone={FLOW_NODE_TONE.clienteReferencias}
      icon={Layers}
      title="Referências"
      selected={selected}
      className="w-60"
      meta={
        refs.length > 0 && (
          <span className="rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-muted-foreground">
            {refs.length}
          </span>
        )
      }
    >
      {refs.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {refs.map((url, i) => (
            <NodeThumb
              key={`${url}-${i}`}
              url={url}
              alt={`Ref ${i + 1}`}
              onPopOut={() => popOut(url, i)}
              onRemove={() => remove(url, i)}
            />
          ))}
        </div>
      ) : (
        <NodeImagePlaceholder icon={ImageIcon} className="aspect-video">
          <span className="text-[0.625rem] text-muted-foreground">Sem referências</span>
        </NodeImagePlaceholder>
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
