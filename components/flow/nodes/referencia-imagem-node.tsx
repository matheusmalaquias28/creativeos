"use client";

import { Handle, Position } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import type { ReferenciaImagemData } from "@/lib/flow/types";

export function ReferenciaImagemNode({ data }: { data: ReferenciaImagemData }) {
  return (
    <div className="w-40 rounded-xl border border-rose-500/25 bg-rose-500/6 p-2.5 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex size-5 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/15">
          <ImageIcon className="size-3 text-rose-400" strokeWidth={1.5} />
        </div>
        <span className="truncate text-[0.5625rem] font-semibold uppercase tracking-widest text-rose-400">
          {data.label || "Imagem"}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-rose-500/15 bg-rose-500/5">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.label || "Referência"}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center">
            <ImageIcon className="size-6 text-rose-500/20" strokeWidth={1} />
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-rose-500/50 !bg-rose-500/30"
      />
    </div>
  );
}
