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
          stroke: selected ? "var(--primary)" : "var(--border-strong)",
          strokeWidth: selected ? 2 : 1.5,
        }}
      />

      {selected && (
        <EdgeLabelRenderer>
          <button
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="nodrag nopan pointer-events-auto absolute flex size-6 items-center justify-center rounded-full border border-tone-red/40 bg-popover text-tone-red shadow-[var(--surface-shadow-elevated)] transition-premium hover:border-tone-red/70 hover:bg-tone-red hover:text-background"
            title="Remover conexão"
            onClick={() =>
              setEdges((eds) => eds.filter((e) => e.id !== id))
            }
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
