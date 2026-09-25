"use client";

import { Handle, Position } from "@xyflow/react";
import { ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import type { SaidaArteData } from "@/lib/flow/types";

export function SaidaArteNode({
  data,
  selected,
}: {
  data: SaidaArteData;
  selected?: boolean;
}) {
  const label = data.label ?? `Arte ${data.artIndex + 1}`;
  const isProcessing =
    data.generatingStatus === "processing" || data.generatingStatus === "queued";
  const isFailed = data.generatingStatus === "failed";

  return (
    <NodeShell
      tone={isFailed ? "red" : FLOW_NODE_TONE.saidaArte}
      icon={isFailed ? AlertCircle : ImageIcon}
      iconNode={isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : undefined}
      title={label}
      selected={selected}
      className="w-44"
      meta={
        isProcessing ? (
          <Badge variant="blue" className="h-5 px-2 text-[0.625rem]">
            {data.generatingStatus === "queued" ? "Na fila" : "Gerando"}
          </Badge>
        ) : isFailed ? (
          <Badge variant="red" className="h-5 px-2 text-[0.625rem]">
            Falhou
          </Badge>
        ) : null
      }
    >
      <Handle type="target" position={Position.Left} className={flowHandleClass} />

      {/* Result area */}
      {data.resultUrl ? (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.resultUrl}
            alt={label}
            className="w-full object-cover"
            style={{ imageRendering: "auto" }}
          />
        </div>
      ) : isProcessing ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-tone-blue/25 bg-tone-blue/8">
          <Loader2 className="size-5 animate-spin text-tone-blue" />
          <span className="text-[0.625rem] font-medium text-tone-blue">
            {data.generatingStatus === "queued" ? "na fila…" : "gerando…"}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-tone-red/25 bg-tone-red/8">
          <AlertCircle className="size-5 text-tone-red" />
          <span className="text-[0.625rem] font-medium text-tone-red">falhou</span>
        </div>
      ) : (
        <NodeImagePlaceholder icon={ImageIcon} className="aspect-square">
          <span className="text-[0.625rem] text-muted-foreground">Aguardando geração</span>
        </NodeImagePlaceholder>
      )}
    </NodeShell>
  );
}
