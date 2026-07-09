"use client";

import { useState } from "react";
import { Handle, Position, useReactFlow, useNodes, useEdges } from "@xyflow/react";
import { Sparkles, Settings2, Play, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { GerarImagemData, SaidaArteData } from "@/lib/flow/types";

const ASPECT_RATIOS = ["1:1", "4:5", "3:4", "4:3", "9:16", "16:9", "3:2"];
const IMAGE_SIZES = ["1K", "2K", "4K"];

type Props = { id: string; data: GerarImagemData; selected?: boolean };

export function GerarImagemNode({ id, data, selected }: Props) {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const edges = useEdges();
  const [open, setOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);

  function update(patch: Partial<GerarImagemData>) {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }

  // ─── Individual execute ───────────────────────────────────────────────

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
      {/* logo handle */}
      <Handle type="target" position={Position.Left} id="logo" style={{ top: "28%" }}
        className="!size-2.5 !border-blue-500/50 !bg-blue-500/30" />
      {/* refs handle */}
      <Handle type="target" position={Position.Left} id="refs" style={{ top: "50%" }}
        className="!size-2.5 !border-violet-500/50 !bg-violet-500/30" />
      {/* prompt handle */}
      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "72%" }}
        className="!size-2.5 !border-amber-500/50 !bg-amber-500/30" />

      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/15">
            <Sparkles className="size-3 text-cyan-400" strokeWidth={1.5} />
          </div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-cyan-400">
            Gerar
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex size-5 items-center justify-center rounded border border-white/8 bg-white/4 text-muted-foreground/50 hover:text-foreground/70"
          >
            <Settings2 className="size-3" />
          </button>
          {/* Individual execute button */}
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
      </div>

      {/* Settings panel */}
      {open ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[0.5625rem] uppercase tracking-wider text-cyan-400/60">
              Aspect ratio
            </label>
            <div className="flex flex-wrap gap-1">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => update({ aspectRatio: r })}
                  className={`rounded px-1.5 py-0.5 text-[0.5625rem] font-medium transition-colors ${
                    (data.aspectRatio ?? "1:1") === r
                      ? "bg-cyan-500/25 text-cyan-300"
                      : "bg-white/4 text-muted-foreground/50 hover:bg-white/8"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[0.5625rem] uppercase tracking-wider text-cyan-400/60">
              Resolução
            </label>
            <div className="flex gap-1">
              {IMAGE_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => update({ imageSize: s })}
                  className={`rounded px-1.5 py-0.5 text-[0.5625rem] font-medium transition-colors ${
                    (data.imageSize ?? "2K") === s
                      ? "bg-cyan-500/25 text-cyan-300"
                      : "bg-white/4 text-muted-foreground/50 hover:bg-white/8"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.5625rem] text-muted-foreground/60">
            {data.aspectRatio ?? "1:1"}
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.5625rem] text-muted-foreground/60">
            {data.imageSize ?? "2K"}
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-cyan-500/50 !bg-cyan-500/30"
      />
    </div>
  );
}
