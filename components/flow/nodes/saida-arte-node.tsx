"use client";

import { Handle, Position } from "@xyflow/react";
import { ImageIcon, Loader2, AlertCircle } from "lucide-react";
import type { SaidaArteData } from "@/lib/flow/types";

export function SaidaArteNode({ data }: { data: SaidaArteData }) {
  const label = data.label ?? `Arte ${data.artIndex + 1}`;
  const isProcessing =
    data.generatingStatus === "processing" || data.generatingStatus === "queued";
  const isFailed = data.generatingStatus === "failed";

  return (
    <div className="w-44 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 backdrop-blur-sm">
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-emerald-500/50 !bg-emerald-500/30"
      />

      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <div
          className={`flex size-5 shrink-0 items-center justify-center rounded-md border bg-emerald-500/15 ${
            isProcessing
              ? "border-emerald-400/60"
              : isFailed
              ? "border-red-500/40"
              : "border-emerald-500/30"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="size-3 animate-spin text-emerald-400" />
          ) : isFailed ? (
            <AlertCircle className="size-3 text-red-400" />
          ) : (
            <ImageIcon className="size-3 text-emerald-400" strokeWidth={1.5} />
          )}
        </div>
        <span className="truncate text-[0.6875rem] font-semibold uppercase tracking-widest text-emerald-400">
          {label}
        </span>
      </div>

      {/* Result area */}
      {data.resultUrl ? (
        <div className="overflow-hidden rounded-lg border border-emerald-500/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.resultUrl}
            alt={label}
            className="w-full object-cover"
            style={{ imageRendering: "auto" }}
          />
        </div>
      ) : isProcessing ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-500/5">
          <Loader2 className="size-5 animate-spin text-emerald-400/50" />
          <span className="text-[0.5625rem] text-emerald-400/40">
            {data.generatingStatus === "queued" ? "na fila…" : "gerando…"}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5">
          <AlertCircle className="size-5 text-red-400/50" />
          <span className="text-[0.5625rem] text-red-400/50">falhou</span>
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-emerald-500/10 bg-emerald-500/3">
          <ImageIcon className="size-6 text-emerald-500/20" strokeWidth={1} />
        </div>
      )}
    </div>
  );
}
