"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import { NodeImage } from "@/components/flow/nodes/node-image";
import { downloadImageUrl, imageFilename } from "@/lib/flow/download-image";
import { flowHandleClass } from "@/components/flow/nodes/node-shell";
import type { ReferenciaImagemData } from "@/lib/flow/types";

export function ReferenciaImagemNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: ReferenciaImagemData;
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
        url={data.imageUrl}
        name={data.label || "Imagem"}
        alt={data.label || "Referência"}
        selected={selected}
        onRename={rename}
        onDownload={
          data.imageUrl
            ? () => void downloadImageUrl(data.imageUrl!, imageFilename(data.label || "imagem", data.imageUrl!))
            : undefined
        }
      />
      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </div>
  );
}
