"use client";

import { Handle, Position } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import type { ClienteLogoData } from "@/lib/flow/types";

export function ClienteLogoNode({
  data,
  selected,
}: {
  data: ClienteLogoData;
  selected?: boolean;
}) {
  return (
    <NodeShell
      tone={FLOW_NODE_TONE.clienteLogo}
      icon={ImageIcon}
      title="Logo"
      selected={selected}
      className="w-44"
    >
      {data.logoUrl ? (
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
          <img
            src={data.logoUrl}
            alt="Logo"
            className="max-h-full max-w-full object-contain p-2"
          />
        </div>
      ) : (
        <NodeImagePlaceholder icon={ImageIcon} className="aspect-video">
          <span className="text-[0.625rem] text-muted-foreground">Sem logo</span>
        </NodeImagePlaceholder>
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
