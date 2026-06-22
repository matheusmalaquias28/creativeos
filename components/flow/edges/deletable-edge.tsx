"use client";

import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "oklch(0.75 0.1 265)" : "oklch(1 0 0 / 15%)",
          strokeWidth: selected ? 2 : 1.5,
        }}
      />

      {selected && (
        <EdgeLabelRenderer>
          <button
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="pointer-events-auto absolute flex size-5 items-center justify-center rounded-full border border-red-500/40 bg-[oklch(0.09_0.007_265)] text-red-400 shadow-sm transition-colors hover:border-red-500/70 hover:bg-red-500/15"
            title="Remover conexão"
            onClick={() =>
              setEdges((eds) => eds.filter((e) => e.id !== id))
            }
          >
            <X className="size-2.5" strokeWidth={2.5} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
