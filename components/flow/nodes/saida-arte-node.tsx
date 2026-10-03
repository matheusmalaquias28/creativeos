"use client";

import { useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { ImageIcon, Loader2, AlertCircle, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { cn } from "@/lib/utils";
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

  // Pilha de imagens geradas por este node (fallback para o resultUrl único).
  const stack =
    data.resultUrls && data.resultUrls.length > 0
      ? data.resultUrls
      : data.resultUrl
        ? [{ versionId: "current", url: data.resultUrl }]
        : [];

  const [index, setIndex] = useState(stack.length - 1);

  // Ao chegar uma pilha nova (gerou de novo), salta para a última.
  useEffect(() => {
    setIndex(Math.max(0, stack.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack.length]);

  const safeIndex = Math.min(Math.max(0, index), Math.max(0, stack.length - 1));
  const current = stack[safeIndex];

  function handleDownload() {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = `${label.replace(/\s+/g, "-").toLowerCase()}-${safeIndex + 1}.png`;
    a.target = "_blank";
    a.click();
  }

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
        ) : stack.length > 1 ? (
          <span className="rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-muted-foreground">
            {safeIndex + 1}/{stack.length}
          </span>
        ) : null
      }
    >
      <Handle type="target" position={Position.Left} className={flowHandleClass} />

      {/* Result area */}
      {current ? (
        <div className="space-y-1.5">
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={label}
              className="w-full object-cover"
              style={{ imageRendering: "auto" }}
            />

            {/* Navegação da pilha */}
            {stack.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i - 1 + stack.length) % stack.length)}
                  className="nodrag absolute left-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur transition-premium hover:bg-card"
                  title="Anterior"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % stack.length)}
                  className="nodrag absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur transition-premium hover:bg-card"
                  title="Próxima"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="nodrag absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-lg border border-border bg-card/80 text-foreground backdrop-blur transition-premium hover:border-primary/50 hover:bg-primary hover:text-primary-foreground"
              title="Baixar esta arte"
            >
              <Download className="size-3" />
            </button>
          </div>

          {/* Tira de miniaturas da pilha */}
          {stack.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {stack.map((item, i) => (
                <button
                  key={item.versionId}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "nodrag size-8 shrink-0 overflow-hidden rounded-md border transition-premium",
                    i === safeIndex ? "border-primary ring-1 ring-primary/40" : "border-border opacity-70 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={`${label} ${i + 1}`} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
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
