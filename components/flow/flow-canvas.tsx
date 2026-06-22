"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  RotateCcw,
  Save,
  Play,
  Loader2,
  ImageIcon,
  GitBranch,
  Sparkles,
  FileText,
  Layers,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ClienteLogoNode } from "@/components/flow/nodes/cliente-logo-node";
import { ClienteReferenciasNode } from "@/components/flow/nodes/cliente-referencias-node";
import { PromptArteNode } from "@/components/flow/nodes/prompt-arte-node";
import { GerarImagemNode } from "@/components/flow/nodes/gerar-imagem-node";
import { SaidaArteNode } from "@/components/flow/nodes/saida-arte-node";
import { ReferenciaImagemNode } from "@/components/flow/nodes/referencia-imagem-node";
import { DeletableEdge } from "@/components/flow/edges/deletable-edge";
import { FlowCanvasContext } from "@/components/flow/flow-canvas-context";
import { gerarFluxoDaDemanda } from "@/lib/flow/generator";
import type { FlowGraph, SaidaArteData } from "@/lib/flow/types";
import type { CreativeDemand } from "@/types/demand";

// ─── Stable maps (outside component) ─────────────────────────────────────

const nodeTypes: NodeTypes = {
  clienteLogo: ClienteLogoNode,
  clienteReferencias: ClienteReferenciasNode,
  promptArte: PromptArteNode,
  gerarImagem: GerarImagemNode,
  saidaArte: SaidaArteNode,
  referenciaImagem: ReferenciaImagemNode,
};

const edgeTypes: EdgeTypes = {
  default: DeletableEdge,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const EDGE_DEFAULTS: Partial<Edge> = {
  type: "default",
  animated: false,
  style: { stroke: "oklch(1 0 0 / 15%)", strokeWidth: 1.5 },
};

function graphToRF(graph: FlowGraph): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) => ({ ...n })) as Node[],
    edges: graph.edges.map((e) => ({ ...e, ...EDGE_DEFAULTS })) as Edge[],
  };
}

/** Converts RF state back to a plain FlowGraph, stripping runtime-only fields. */
function rfToGraph(nodes: Node[], edges: Edge[]): FlowGraph {
  return {
    nodes: nodes.map((n) => {
      if (n.type === "saidaArte") {
        // resultUrl and generatingStatus are runtime-only — never persist them
        const { resultUrl: _r, generatingStatus: _g, ...data } =
          n.data as SaidaArteData;
        return { ...n, data };
      }
      return n;
    }) as FlowGraph["nodes"],
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({
      id,
      source,
      sourceHandle: sourceHandle ?? undefined,
      target,
      targetHandle: targetHandle ?? undefined,
    })),
  };
}

// ─── Node palette ─────────────────────────────────────────────────────────

const PALETTE_ITEMS = [
  { type: "clienteLogo", label: "Logo", icon: ImageIcon, color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { type: "clienteReferencias", label: "Refs", icon: Layers, color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  { type: "promptArte", label: "Prompt", icon: FileText, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { type: "gerarImagem", label: "Gerar", icon: Sparkles, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
  { type: "saidaArte", label: "Saída", icon: GitBranch, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { type: "referenciaImagem", label: "Imagem", icon: ImageIcon, color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
] as const;

// ─── Inner canvas ─────────────────────────────────────────────────────────

type ClientProfile = {
  logoUrl?: string | null;
  referenceUrls?: string[];
};

type InnerProps = {
  demanda: Pick<CreativeDemand, "id" | "client_id" | "artes" | "briefing">;
  numArtes: number;
  initialGraph: FlowGraph | null;
  clientProfile?: ClientProfile;
};

// Job row shape from Realtime
type JobRow = {
  id: string;
  art_index: number;
  status: string;
};

function FlowCanvasInner({ demanda, numArtes, initialGraph, clientProfile }: InnerProps) {
  const router = useRouter();
  const { screenToFlowPosition, getViewport, getNodes, getEdges } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const defaultGraph = initialGraph ?? gerarFluxoDaDemanda(demanda, numArtes);
  const { nodes: initNodes, edges: initEdges } = graphToRF(defaultGraph);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  // "✓" indicator that briefly flashes after a silent auto-save
  const [autoSavedFlash, setAutoSavedFlash] = useState(false);

  const busy = saving || running;

  // ─── Save ─────────────────────────────────────────────────────────────

  const save = useCallback(
    async (silent = false): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch(`/api/demands/${demanda.id}/flow`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graph: rfToGraph(getNodes(), getEdges()) }),
        });
        if (!res.ok) throw new Error(await res.text());
        if (!silent) toast.success("Fluxo salvo");
        return true;
      } catch (err) {
        toast.error("Erro ao salvar", {
          description: err instanceof Error ? err.message : String(err),
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [demanda.id, getNodes, getEdges]
  );

  // ─── Auto-save debounce ────────────────────────────────────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const ok = await save(true);
      if (ok) {
        setAutoSavedFlash(true);
        setTimeout(() => setAutoSavedFlash(false), 1800);
      }
    }, 1500);
  }, [save]);

  const saveNow = useCallback(async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const ok = await save(true);
    if (ok) {
      setAutoSavedFlash(true);
      setTimeout(() => setAutoSavedFlash(false), 1800);
    }
  }, [save]);

  // Wrapped change handlers that trigger auto-save on user actions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const isUserChange = changes.some(
        (c) => c.type !== "select" && c.type !== "dimensions"
      );
      if (isUserChange) scheduleAutoSave();
    },
    [onNodesChange, scheduleAutoSave]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      if (changes.length > 0) scheduleAutoSave();
    },
    [onEdgesChange, scheduleAutoSave]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, ...EDGE_DEFAULTS }, eds));
      scheduleAutoSave();
    },
    [setEdges, scheduleAutoSave]
  );

  // ─── Real-time: art_generation_job ────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`flow-jobs-${demanda.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "art_generation_job",
          filter: `demand_id=eq.${demanda.id}`,
        },
        async (payload) => {
          const job = (payload.new ?? payload.old) as JobRow | null;
          if (!job || job.art_index === undefined) return;

          const status = job.status as SaidaArteData["generatingStatus"];

          // Immediately reflect status change in the node
          setNodes((ns) =>
            ns.map((n) => {
              if (n.type !== "saidaArte") return n;
              if ((n.data as SaidaArteData).artIndex !== job.art_index) return n;
              return { ...n, data: { ...n.data, generatingStatus: status } };
            })
          );

          if (job.status === "succeeded") {
            // art_version is inserted before the job is marked succeeded, so it's
            // safe to query immediately
            const { data: version } = await supabase
              .from("art_version")
              .select("result_url")
              .eq("job_id", job.id)
              .eq("is_current", true)
              .maybeSingle();

            if (version?.result_url) {
              setNodes((ns) =>
                ns.map((n) => {
                  if (n.type !== "saidaArte") return n;
                  if ((n.data as SaidaArteData).artIndex !== job.art_index) return n;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      resultUrl: version.result_url,
                      generatingStatus: "succeeded" as const,
                    },
                  };
                })
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demanda.id, setNodes]);

  // ─── Connections ──────────────────────────────────────────────────────

  const onConnect = handleConnect;

  // ─── Drag-and-drop images ─────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const file = e.dataTransfer.files[0];
      if (!file?.type.startsWith("image/")) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const reader = new FileReader();
      reader.onload = (ev) => {
        const imageUrl = ev.target?.result as string;
        setNodes((ns) => [
          ...ns,
          {
            id: `img-${Date.now()}`,
            type: "referenciaImagem",
            position,
            data: { imageUrl, label: file.name.replace(/\.[^.]+$/, "") },
          } as Node,
        ]);
        scheduleAutoSave();
      };
      reader.readAsDataURL(file);
    },
    [screenToFlowPosition, setNodes, scheduleAutoSave]
  );

  // ─── Node palette ─────────────────────────────────────────────────────

  function addNode(type: (typeof PALETTE_ITEMS)[number]["type"]) {
    const { x, y, zoom } = getViewport();
    const cx = (window.innerWidth / 2 - x) / zoom;
    const cy = (window.innerHeight / 2 - y) / zoom;
    const id = `${type}-${Date.now()}`;

    const data: Record<string, unknown> =
      type === "clienteLogo"
        ? { clientId: demanda.client_id ?? "", logoUrl: clientProfile?.logoUrl ?? null }
        : type === "clienteReferencias"
        ? { clientId: demanda.client_id ?? "", referenceUrls: clientProfile?.referenceUrls ?? [] }
        : type === "promptArte"
        ? { artIndex: nodes.filter((n) => n.type === "promptArte").length }
        : type === "saidaArte"
        ? {
            artIndex: nodes.filter((n) => n.type === "saidaArte").length,
            label: `Arte ${nodes.filter((n) => n.type === "saidaArte").length + 1}`,
          }
        : type === "referenciaImagem"
        ? { imageUrl: null, label: "Imagem" }
        : {};

    setNodes((ns) => [
      ...ns,
      { id, type, position: { x: cx - 80, y: cy - 40 }, data } as Node,
    ]);
    scheduleAutoSave();
  }

  // ─── Execute ──────────────────────────────────────────────────────────

  async function execute() {
    setRunning(true);
    try {
      if (!(await save(false))) return;

      // Optimistically mark all saidaArte nodes as queued
      setNodes((ns) =>
        ns.map((n) => {
          if (n.type !== "saidaArte") return n;
          return { ...n, data: { ...n.data, generatingStatus: "queued" as const } };
        })
      );

      const res = await fetch(`/api/demands/${demanda.id}/flow/run`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Erro desconhecido");
      }
      const data = (await res.json()) as { jobsCreated: number };
      toast.success(`${data.jobsCreated} arte(s) enfileirada(s)`, {
        description: "Acompanhe o progresso na curadoria.",
        action: {
          label: "Curadoria",
          onClick: () => router.push(`/demands/${demanda.id}/curation`),
        },
      });
    } catch (err) {
      toast.error("Erro ao executar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    const fresh = gerarFluxoDaDemanda(demanda, numArtes);
    const { nodes: n, edges: e } = graphToRF(fresh);
    setNodes(n);
    setEdges(e);
    toast.info("Fluxo redefinido para o padrão");
    scheduleAutoSave();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/6 px-4 py-2">
        <span className="text-[0.6875rem] text-muted-foreground/40">
          Drag &amp; drop imagens · clique numa linha para deletar
        </span>
        <div className="flex items-center gap-2">
          {/* Auto-save indicator */}
          <span
            className={`text-[0.5625rem] text-muted-foreground/40 transition-opacity duration-500 ${
              saving ? "opacity-100" : autoSavedFlash ? "opacity-80" : "opacity-0"
            }`}
          >
            {saving ? "salvando…" : "✓ salvo"}
          </span>

          <button onClick={reset} disabled={busy} className="flow-btn">
            <RotateCcw className="size-3" /> Resetar
          </button>
          <button onClick={() => save(false)} disabled={busy} className="flow-btn">
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            Salvar
          </button>
          <button
            onClick={execute}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3 py-1.5 text-[0.6875rem] font-medium text-emerald-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/20 disabled:pointer-events-none disabled:opacity-40"
          >
            {running ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3 fill-current" />
            )}
            Executar
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="relative min-h-0 flex-1">
        <FlowCanvasContext.Provider value={{ scheduleAutoSave, saveNow }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.25}
            maxZoom={2}
            deleteKeyCode="Backspace"
            colorMode="dark"
            defaultEdgeOptions={EDGE_DEFAULTS}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="oklch(1 0 0 / 5%)" />
            <Controls className="[&>button]:border-white/8 [&>button]:bg-white/4 [&>button]:text-muted-foreground [&>button:hover]:bg-white/8" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === "clienteLogo") return "oklch(0.6 0.18 250)";
                if (n.type === "clienteReferencias") return "oklch(0.6 0.18 290)";
                if (n.type === "promptArte") return "oklch(0.7 0.18 85)";
                if (n.type === "gerarImagem") return "oklch(0.7 0.15 200)";
                if (n.type === "saidaArte") return "oklch(0.7 0.18 145)";
                if (n.type === "referenciaImagem") return "oklch(0.65 0.18 10)";
                return "oklch(0.4 0 0)";
              }}
              maskColor="oklch(0.06 0.005 265 / 80%)"
              className="rounded-xl border border-white/6 bg-card"
            />
          </ReactFlow>
        </FlowCanvasContext.Provider>

        {/* Node palette — floating bottom center */}
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/8 bg-[oklch(0.09_0.007_265/90%)] p-1.5 backdrop-blur-md shadow-lg">
            <span className="pl-1 text-[0.5625rem] uppercase tracking-wider text-muted-foreground/40">
              Adicionar
            </span>
            {PALETTE_ITEMS.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => addNode(type)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.5625rem] font-medium transition-colors hover:opacity-80 ${color}`}
                title={`Adicionar nó ${label}`}
              >
                <Plus className="size-2.5" />
                <Icon className="size-2.5" strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────

export type FlowCanvasProps = InnerProps;

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
