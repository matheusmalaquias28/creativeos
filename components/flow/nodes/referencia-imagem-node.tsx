"use client";

import { Handle, Position } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import type { ReferenciaImagemData } from "@/lib/flow/types";

export function ReferenciaImagemNode({
  data,
  selected,
}: {
  data: ReferenciaImagemData;
  selected?: boolean;
}) {
  return (
    <NodeShell
      tone={FLOW_NODE_TONE.referenciaImagem}
      icon={ImageIcon}
      title={data.label || "Imagem"}
      selected={selected}
      className="w-40"
      bodyClassName="p-2.5"
    >
      {data.imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <img
            src={data.imageUrl}
            alt={data.label || "Referência"}
            className="aspect-square w-full object-cover"
          />
        </div>
      ) : (
        <NodeImagePlaceholder icon={ImageIcon} className="aspect-square" />
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
