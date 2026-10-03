"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import { NodeImage } from "@/components/flow/nodes/node-image";
import { flowHandleClass } from "@/components/flow/nodes/node-shell";
import type { ClienteLogoData } from "@/lib/flow/types";

export function ClienteLogoNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: ClienteLogoData;
  selected?: boolean;
}) {
  const { setNodes } = useReactFlow();
  const { scheduleAutoSave } = useFlowCanvas();

  function rename(label: string) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
    scheduleAutoSave();
  }

  return (
    <div className="relative">
      <NodeImage
        url={data.logoUrl ?? null}
        name={data.label ?? "Logo"}
        alt="Logo"
        selected={selected}
        onRename={rename}
      />
      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </div>
  );
}
