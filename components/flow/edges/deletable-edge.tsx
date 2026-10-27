"use client";

import { useRef, useState, type MouseEvent } from "react";
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { nearestPointOnPath } from "@/components/flow/edges/path-geometry";

/** Some o botão um instante depois de sair da linha (dá tempo de alcançá-lo). */
const HIDE_DELAY_MS = 150;

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
  const { deleteElements, screenToFlowPosition } = useReactFlow();
  const pathRef = useRef<SVGPathElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ponto da linha mais perto do mouse (coordenadas do fluxo); null = sem hover.
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };

  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setHoverPoint(null), HIDE_DELAY_MS);
  };

  const followMouse = (e: MouseEvent) => {
    cancelHide();
    if (!pathRef.current) return;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setHoverPoint(nearestPointOnPath(pathRef.current, p));
  };

  // Hover manda na posição; selecionada sem hover, o botão fica no meio.
  const button = hoverPoint ?? (selected ? { x: labelX, y: labelY } : null);
  const highlighted = selected || hoverPoint !== null;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={0}
        style={{
          ...style,
          stroke: highlighted ? "var(--primary)" : "var(--border-strong)",
          strokeWidth: highlighted ? 2 : 1.5,
        }}
      />
      {/* Faixa invisível larga: hover/clique na linha (substitui a do BaseEdge). */}
      <path
        ref={pathRef}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseMove={followMouse}
        onMouseLeave={scheduleHide}
      />

      {button && (
        <EdgeLabelRenderer>
          <button
            style={{
              transform: `translate(-50%, -50%) translate(${button.x}px,${button.y}px)`,
            }}
            className="nodrag nopan pointer-events-auto absolute flex size-6 items-center justify-center rounded-full border border-tone-red/40 bg-popover text-tone-red shadow-[var(--surface-shadow-elevated)] transition-colors hover:border-tone-red/70 hover:bg-tone-red hover:text-background"
            title="Remover conexão"
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            onClick={() => deleteElements({ edges: [{ id }] })}
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
