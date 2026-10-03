"use client";

import { useState } from "react";
import { Handle, Position, useNodes, useEdges, useReactFlow } from "@xyflow/react";
import { Sparkles, Play, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import type { GerarImagemData, SaidaArteData } from "@/lib/flow/types";

type Props = { id: string; data: GerarImagemData; selected?: boolean };

const ASPECT_OPTIONS = ["4:5", "9:16", "1:1", "3:4", "16:9"];
const QUALITY_OPTIONS: { value: "low" | "medium" | "high"; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const SIZE_OPTIONS = ["1K", "2K", "4K"];
const COUNT_OPTIONS = [1, 2, 3, 4, 6];

function NodeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[0.5625rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="nodrag w-full rounded-md border border-border bg-input px-1.5 py-1 font-mono text-[0.625rem] text-foreground transition-premium hover:border-border-strong focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GerarImagemNode({ id, data, selected }: Props) {
  const nodes = useNodes();
  const edges = useEdges();
  const { setNodes } = useReactFlow();
  const { scheduleAutoSave } = useFlowCanvas();
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);

  function update(patch: Partial<GerarImagemData>) {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
    scheduleAutoSave();
  }

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
    <NodeShell
      tone={FLOW_NODE_TONE.gerarImagem}
      icon={Sparkles}
      title="Gerar imagem"
      selected={selected}
      className="w-56"
      meta={
        <button
          onClick={handleExecute}
          disabled={executing}
          title="Executar somente este nó"
          className={cn(
            "nodrag flex size-6 shrink-0 items-center justify-center rounded-lg border transition-premium disabled:pointer-events-none disabled:opacity-50",
            done
              ? tones.green.badge
              : "border-border bg-secondary text-foreground hover:border-primary/50 hover:bg-primary hover:text-primary-foreground"
          )}
        >
          {executing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : done ? (
            <Check className="size-3" />
          ) : (
            <Play className="size-2.5 fill-current" />
          )}
        </button>
      }
    >
      {/* Entradas tipadas — a cor do conector acompanha o nó de origem */}
      <Handle type="target" position={Position.Left} id="logo" style={{ top: "28%" }}
        className={cn(flowHandleClass, "!bg-tone-blue")} title="Logo" />
      <Handle type="target" position={Position.Left} id="refs" style={{ top: "50%" }}
        className={cn(flowHandleClass, "!bg-tone-violet")} title="Referências" />
      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "72%" }}
        className={cn(flowHandleClass, "!bg-tone-amber")} title="Prompt" />

      <div className="grid grid-cols-2 gap-1.5">
        <NodeSelect
          label="Formato"
          value={data.aspectRatio ?? "4:5"}
          options={ASPECT_OPTIONS.map((v) => ({ value: v, label: v }))}
          onChange={(v) => update({ aspectRatio: v })}
        />
        <NodeSelect
          label="Esforço"
          value={data.quality ?? "medium"}
          options={QUALITY_OPTIONS}
          onChange={(v) => update({ quality: v as "low" | "medium" | "high" })}
        />
        <NodeSelect
          label="Resolução"
          value={data.imageSize ?? "2K"}
          options={SIZE_OPTIONS.map((v) => ({ value: v, label: v }))}
          onChange={(v) => update({ imageSize: v })}
        />
        <NodeSelect
          label="Quantidade"
          value={String(data.count ?? 1)}
          options={COUNT_OPTIONS.map((v) => ({ value: String(v), label: String(v) }))}
          onChange={(v) => update({ count: Number(v) })}
        />
      </div>

      <div className="mt-2 flex items-center gap-2.5 text-[0.625rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", tones.blue.dot)} /> Logo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", tones.violet.dot)} /> Refs
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", tones.amber.dot)} /> Prompt
        </span>
      </div>

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
