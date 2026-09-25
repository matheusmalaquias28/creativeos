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
  Pause,
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
import { FLOW_NODE_TONE } from "@/components/flow/nodes/node-shell";
import { Button } from "@/components/ui/button";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { gerarFluxoDaDemanda, gerarSubfluxoDaDemanda, ROW_H } from "@/lib/flow/generator";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
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
  style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
};

/**
 * Tema do React Flow via variáveis CSS do próprio xyflow apontando para os
 * tokens do design system — acompanha claro/escuro sem cores fixas.
 */
const FLOW_THEME_VARS = {
  "--xy-background-color": "var(--background)",
  "--xy-background-pattern-color": "var(--border-strong)",
  "--xy-edge-stroke": "var(--border-strong)",
  "--xy-edge-stroke-selected": "var(--primary)",
  "--xy-connectionline-stroke": "var(--primary)",
  "--xy-connectionline-stroke-width": "2",
  "--xy-handle-background-color": "var(--primary)",
  "--xy-handle-border-color": "var(--card)",
  "--xy-selection-background-color": "color-mix(in oklch, var(--primary) 8%, transparent)",
  "--xy-selection-border": "1px dashed color-mix(in oklch, var(--primary) 60%, transparent)",
  "--xy-controls-button-background-color": "var(--card)",
  "--xy-controls-button-background-color-hover": "var(--accent)",
  "--xy-controls-button-color": "var(--muted-foreground)",
  "--xy-controls-button-color-hover": "var(--foreground)",
  "--xy-controls-button-border-color": "var(--border)",
  "--xy-controls-box-shadow": "var(--surface-shadow-elevated)",
  "--xy-minimap-background-color": "var(--card)",
  "--xy-minimap-mask-background-color": "color-mix(in oklch, var(--background) 65%, transparent)",
  "--xy-minimap-node-background-color": "var(--muted)",
  "--xy-attribution-background-color": "transparent",
  "--xy-edge-label-background-color": "var(--popover)",
  "--xy-edge-label-color": "var(--foreground)",
} as React.CSSProperties;

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
  { type: "clienteLogo", label: "Logo", icon: ImageIcon },
  { type: "clienteReferencias", label: "Refs", icon: Layers },
  { type: "promptArte", label: "Prompt", icon: FileText },
  { type: "gerarImagem", label: "Gerar", icon: Sparkles },
  { type: "saidaArte", label: "Saída", icon: GitBranch },
  { type: "referenciaImagem", label: "Imagem", icon: ImageIcon },
] as const;

function minimapNodeColor(type: string | undefined): string {
  if (type && type in FLOW_NODE_TONE) {
    return tones[FLOW_NODE_TONE[type as keyof typeof FLOW_NODE_TONE]].cssVar;
  }
  return "var(--muted-foreground)";
}

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
        : type === "gerarImagem"
        ? {
            aspectRatio: IMAGE_GEN_DEFAULTS.aspectRatio,
            imageSize: IMAGE_GEN_DEFAULTS.imageSize,
            model: IMAGE_GEN_DEFAULTS.model,
            quality: IMAGE_GEN_DEFAULTS.quality,
            demandId: demanda.id,
            clientId: demanda.client_id ?? "",
          }
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

  const hasActiveJobs = nodes.some((n) => {
    if (n.type !== "saidaArte") return false;
    const status = (n.data as SaidaArteData).generatingStatus;
    return status === "queued" || status === "processing";
  });

  async function pause() {
    try {
      const res = await fetch("/api/art-gen/cancel-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId: demanda.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { cancelled: number };
      toast.info(
        data.cancelled > 0
          ? `${data.cancelled} geração(ões) pausada(s)`
          : "Nada em andamento pra pausar"
      );
    } catch (err) {
      toast.error("Erro ao pausar", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function reset() {
    // O fluxo é compartilhado por cliente — resetar só pode afetar o bloco DESTA
    // demanda (identificado pelos IDs namespaced "..._${demanda.id}_..."), nunca o
    // grafo inteiro, senão apaga o trabalho de outras demandas do mesmo cliente.
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const belongsToThisDemand = (id: string) => id.includes(demanda.id);

    const keptNodes = currentNodes.filter((n) => !belongsToThisDemand(n.id));
    const keptEdges = currentEdges.filter(
      (e) => !belongsToThisDemand(e.source) && !belongsToThisDemand(e.target)
    );

    const logoId = currentNodes.find((n) => n.type === "clienteLogo")?.id ?? "logo";
    const refsId = currentNodes.find((n) => n.type === "clienteReferencias")?.id ?? "refs";

    const maxY = keptNodes.reduce((max, n) => {
      if (n.type === "clienteLogo" || n.type === "clienteReferencias") return max;
      return Math.max(max, n.position.y);
    }, -ROW_H);
    const yOffset = keptNodes.length > 2 ? maxY + ROW_H : 0;

    const subGraph = gerarSubfluxoDaDemanda(demanda, numArtes, { logoId, refsId, yOffset });
    const { nodes: newNodes, edges: newEdges } = graphToRF(subGraph);

    setNodes([...keptNodes, ...newNodes]);
    setEdges([...keptEdges, ...newEdges]);
    toast.info("Fluxo desta demanda redefinido para o padrão");
    scheduleAutoSave();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-2.5 sm:px-6">
        <span className="hidden text-xs text-muted-foreground md:inline">
          Arraste imagens para o canvas · clique numa conexão para removê-la
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Auto-save indicator */}
          <span
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-1 text-[0.6875rem] font-medium transition-opacity duration-500",
              saving ? "text-muted-foreground" : tones.green.text,
              saving || autoSavedFlash ? "opacity-100" : "opacity-0"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <Check className="size-3" /> Salvo
              </>
            )}
          </span>

          <Button variant="outline" size="sm" onClick={reset} disabled={busy}>
            <RotateCcw /> Resetar
          </Button>
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={busy}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={pause}
            disabled={!hasActiveJobs}
            title="Cancela as gerações em andamento desta demanda"
          >
            <Pause /> Pausar
          </Button>
          <Button size="sm" onClick={execute} disabled={busy}>
            {running ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />}
            Executar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-background">
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
            defaultEdgeOptions={EDGE_DEFAULTS}
            style={FLOW_THEME_VARS}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.2}
              color="var(--border-strong)"
            />
            <Controls className="overflow-hidden rounded-xl border border-border [&>button]:size-8 [&>button]:border-border" />
            <MiniMap
              nodeColor={(n) => minimapNodeColor(n.type)}
              nodeBorderRadius={6}
              maskColor="color-mix(in oklch, var(--background) 65%, transparent)"
              className="overflow-hidden rounded-xl border border-border shadow-[var(--surface-shadow-elevated)]"
            />
          </ReactFlow>
        </FlowCanvasContext.Provider>

        {/* Node palette — floating bottom center */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-popover p-1.5 shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
            <span className="flex shrink-0 items-center gap-1 px-2 text-xs font-semibold text-muted-foreground">
              <Plus className="size-3.5" />
              Adicionar
            </span>
            <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
            {PALETTE_ITEMS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => addNode(type)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-premium hover:bg-accent hover:text-foreground"
                title={`Adicionar nó ${label}`}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-lg",
                    tones[FLOW_NODE_TONE[type]].iconTile
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>
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
