"use client";

import { Handle, Position } from "@xyflow/react";
import { Layers, ImageIcon } from "lucide-react";
import type { ClienteReferenciasData } from "@/lib/flow/types";

export function ClienteReferenciasNode({ data }: { data: ClienteReferenciasData }) {
  const refs = data.referenceUrls ?? [];

  return (
    <div className="w-52 rounded-xl border border-violet-500/25 bg-violet-500/8 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-5 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/15">
          <Layers className="size-3 text-violet-400" strokeWidth={1.5} />
        </div>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-violet-400">
          Referências
        </span>
        {refs.length > 0 && (
          <span className="ml-auto text-[0.5625rem] tabular-nums text-violet-400/60">
            {refs.length}
          </span>
        )}
      </div>

      {refs.length > 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {refs.slice(0, 6).map((url, i) => (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-md border border-violet-500/15 bg-violet-500/5"
            >
              <img
                src={url}
                alt={`Ref ${i + 1}`}
                className="size-full object-cover"
              />
            </div>
          ))}
          {refs.length > 6 && (
            <div className="flex aspect-square items-center justify-center rounded-md border border-violet-500/15 bg-violet-500/5 text-[0.5625rem] text-violet-400/60">
              +{refs.length - 6}
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-violet-500/15 bg-violet-500/5">
          <ImageIcon className="size-6 text-violet-500/20" strokeWidth={1} />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-violet-500/50 !bg-violet-500/30"
      />
    </div>
  );
}
