"use client";

import { Handle, Position } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import type { ClienteLogoData } from "@/lib/flow/types";

export function ClienteLogoNode({ data }: { data: ClienteLogoData }) {
  return (
    <div className="w-44 rounded-xl border border-blue-500/25 bg-blue-500/8 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-5 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/15">
          <ImageIcon className="size-3 text-blue-400" strokeWidth={1.5} />
        </div>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-blue-400">
          Logo
        </span>
      </div>

      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-blue-500/15 bg-blue-500/5">
        {data.logoUrl ? (
          <img
            src={data.logoUrl}
            alt="Logo"
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <ImageIcon className="size-6 text-blue-500/20" strokeWidth={1} />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-blue-500/50 !bg-blue-500/30"
      />
    </div>
  );
}
