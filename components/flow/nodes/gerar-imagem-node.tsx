"use client";

import { useState } from "react";
import { Handle, Position, useNodes, useEdges } from "@xyflow/react";
import { Sparkles, Play, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import type { GerarImagemData, SaidaArteData } from "@/lib/flow/types";

type Props = { id: string; data: GerarImagemData; selected?: boolean };

export function GerarImagemNode({ id, data, selected }: Props) {
  const nodes = useNodes();
  const edges = useEdges();
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleExecute() {
    if (!data.demandId) {
      toast.error("Salve o fluxo primeiro para executar individualmente");
      return;
    }

    const successorIds = edges.filter((e) => e.source === id).map((e) => e.target);
    const saidaNode = nodes.find(
      (n) => successorIds.includes(n.id) && n.type === "saidaArte"
    );
    const artIndex = (saidaNode?.data as SaidaArteData | undefined)?.artIndex ?? 0;

    setExecuting(true);
    try {
      const res = await fetch(`/api/demands/${data.demandId}/flow/run-node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artIndex }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erro desconhecido");
      }

      setDone(true);
      toast.success(`Arte ${artIndex + 1} enfileirada`, {
        description: "Geração em andamento — acompanhe na curadoria.",
      });
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      toast.error("Erro ao executar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div
      className={`w-52 rounded-xl border bg-cyan-500/5 p-3 backdrop-blur-sm transition-colors ${
        selected
          ? "border-cyan-500/50 shadow-[0_0_0_2px_oklch(0.75_0.15_200/15%)]"
          : "border-cyan-500/20"
      }`}
    >
      <Handle type="target" position={Position.Left} id="logo" style={{ top: "28%" }}
        className="!size-2.5 !border-blue-500/50 !bg-blue-500/30" />
      <Handle type="target" position={Position.Left} id="refs" style={{ top: "50%" }}
        className="!size-2.5 !border-violet-500/50 !bg-violet-500/30" />
      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "72%" }}
        className="!size-2.5 !border-amber-500/50 !bg-amber-500/30" />

      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/15">
            <Sparkles className="size-3 text-cyan-400" strokeWidth={1.5} />
          </div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-cyan-400">
            Gerar
          </span>
        </div>
        <button
          onClick={handleExecute}
          disabled={executing}
          title="Executar somente este nó"
          className={`flex size-5 items-center justify-center rounded border transition-colors ${
            done
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:border-cyan-500/60 hover:bg-cyan-500/20"
          } disabled:pointer-events-none disabled:opacity-50`}
        >
          {executing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : done ? (
            <Check className="size-3" />
          ) : (
            <Play className="size-2.5 fill-current" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.5625rem] text-muted-foreground/60">
          Magnific
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.5625rem] text-muted-foreground/60">
          {IMAGE_GEN_DEFAULTS.aspectRatio}
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.5625rem] text-muted-foreground/60">
          {IMAGE_GEN_DEFAULTS.imageSize}
        </span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.5625rem] text-muted-foreground/60">
          {IMAGE_GEN_DEFAULTS.quality}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-cyan-500/50 !bg-cyan-500/30"
      />
    </div>
  );
}
