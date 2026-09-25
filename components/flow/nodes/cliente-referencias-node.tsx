"use client";

import { Handle, Position } from "@xyflow/react";
import { Layers, ImageIcon } from "lucide-react";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import type { ClienteReferenciasData } from "@/lib/flow/types";

export function ClienteReferenciasNode({
  data,
  selected,
}: {
  data: ClienteReferenciasData;
  selected?: boolean;
}) {
  const refs = data.referenceUrls ?? [];

  return (
    <NodeShell
      tone={FLOW_NODE_TONE.clienteReferencias}
      icon={Layers}
      title="Referências"
      selected={selected}
      className="w-52"
      meta={
        refs.length > 0 && (
          <span className="rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-muted-foreground">
            {refs.length}
          </span>
        )
      }
    >
      {refs.length > 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {refs.slice(0, 6).map((url, i) => (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-lg border border-border bg-surface"
            >
              <img
                src={url}
                alt={`Ref ${i + 1}`}
                className="size-full object-cover"
              />
            </div>
          ))}
          {refs.length > 6 && (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted text-[0.625rem] font-semibold text-muted-foreground">
              +{refs.length - 6}
            </div>
          )}
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
