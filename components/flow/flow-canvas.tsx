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
  Sparkles,
  Layers,
  ListChecks,
  Plus,
  Check,
  Copy,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ClienteLogoNode } from "@/components/flow/nodes/cliente-logo-node";
import { ClienteReferenciasNode } from "@/components/flow/nodes/cliente-referencias-node";
import { PromptArteNode } from "@/components/flow/nodes/prompt-arte-node";
import { GerarImagemNode } from "@/components/flow/nodes/gerar-imagem-node";
import { SaidaArteNode } from "@/components/flow/nodes/saida-arte-node";
import { ReferenciaImagemNode } from "@/components/flow/nodes/referencia-imagem-node";
import { ListaImagensNode } from "@/components/flow/nodes/lista-imagens-node";
import { ArteNode } from "@/components/flow/nodes/arte-node";
import { DeletableEdge } from "@/components/flow/edges/deletable-edge";
import { FlowCanvasContext } from "@/components/flow/flow-canvas-context";
import { FLOW_NODE_TONE } from "@/components/flow/nodes/node-shell";
import { Button } from "@/components/ui/button";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { ARTE_ROW_Y, gerarFluxoDaDemanda, gerarSubfluxoDaDemanda, ROW_H } from "@/lib/flow/generator";
import { IMAGE_GEN_DEFAULTS } from "@/lib/ai/imagegen/defaults";
import type { FlowGraph, ListaImagensData, SaidaArteData } from "@/lib/flow/types";
import type { CreativeDemand } from "@/types/demand";

// ─── Stable maps (outside component) ─────────────────────────────────────

const nodeTypes: NodeTypes = {
  clienteLogo: ClienteLogoNode,
  clienteReferencias: ClienteReferenciasNode,
  promptArte: PromptArteNode,
  gerarImagem: GerarImagemNode,
  saidaArte: SaidaArteNode,
  referenciaImagem: ReferenciaImagemNode,
  listaImagens: ListaImagensNode,
  arte: ArteNode,
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
      if (n.type === "saidaArte" || n.type === "arte") {
        // resultUrl(s) and generatingStatus are runtime-only — never persist them
        const { resultUrl: _r, resultUrls: _rs, generatingStatus: _g, jobId: _j, ...data } =
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
  { type: "arte", label: "Arte", icon: Sparkles },
  { type: "referenciaImagem", label: "Imagem", icon: ImageIcon },
  { type: "listaImagens", label: "Lista", icon: ListChecks },
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
  story_status?: string;
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
  // Menu de contexto (botão direito num node): posição em tela + id do node.
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

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

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const ok = await save(true);
    if (ok) {
      setAutoSavedFlash(true);
      setTimeout(() => setAutoSavedFlash(false), 1800);
    }
    return ok;
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

  // ─── Listas: itens gerados materializados por origem ─────────────────────
  //
  // Imagens GERADAS (pilha de um node arte) só existem em runtime, então são
  // copiadas para `items` da lista com a origem em `itemSources` — é isso que o
  // servidor usa no fan-out. Os itens seguem a origem: regerar/desconectar a
  // origem troca/remove os itens dela (nada de imagem escondida na lista).

  /** Pilha atual de imagens geradas por um node arte/saidaArte. */
  const generatedStackOf = useCallback((n: Node | undefined): string[] => {
    if (!n || (n.type !== "arte" && n.type !== "saidaArte")) return [];
    const d = n.data as SaidaArteData;
    if (d.resultUrls?.length) return d.resultUrls.map((r) => r.url);
    return d.resultUrl ? [d.resultUrl] : [];
  }, []);

  /** Substitui na lista os itens vindos de `sourceId` por `urls`. */
  const withSourceItems = useCallback(
    (list: Node, sourceId: string, urls: string[]): Node => {
      const d = list.data as ListaImagensData;
      const sources = d.itemSources ?? {};
      const kept = (d.items ?? []).filter((u) => sources[u] !== sourceId && !urls.includes(u));
      const itemSources: Record<string, string> = {};
      for (const u of kept) if (sources[u]) itemSources[u] = sources[u];
      for (const u of urls) itemSources[u] = sourceId;
      return { ...list, data: { ...d, items: [...kept, ...urls], itemSources } };
    },
    []
  );

  /** Edges removidas que chegavam numa lista: tira os itens daquela origem. */
  const purgeListItems = useCallback(
    (removed: { source: string; target: string }[]) => {
      if (removed.length === 0) return;
      setNodes((ns) =>
        ns.map((n) => {
          if (n.type !== "listaImagens") return n;
          const gone = removed.filter((e) => e.target === n.id).map((e) => e.source);
          return gone.reduce((acc, src) => withSourceItems(acc, src, []), n);
        })
      );
    },
    [setNodes, withSourceItems]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removedIds = new Set(changes.flatMap((c) => (c.type === "remove" ? [c.id] : [])));
      if (removedIds.size > 0) {
        purgeListItems(getEdges().filter((e) => removedIds.has(e.id)));
      }
      onEdgesChange(changes);
      if (changes.length > 0) scheduleAutoSave();
    },
    [onEdgesChange, scheduleAutoSave, purgeListItems, getEdges]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, ...EDGE_DEFAULTS }, eds));
      // Ligou numa lista um node que já gerou imagens: os itens entram na hora.
      const stack = generatedStackOf(getNodes().find((n) => n.id === connection.source));
      if (stack.length > 0) {
        setNodes((ns) =>
          ns.map((n) =>
            n.id === connection.target && n.type === "listaImagens"
              ? withSourceItems(n, connection.source, stack)
              : n
          )
        );
      }
      scheduleAutoSave();
    },
    [setEdges, setNodes, getNodes, scheduleAutoSave, generatedStackOf, withSourceItems]
  );

  // Depois que um node termina de gerar: troca os itens dele nas listas
  // conectadas pela pilha nova e, se gerou várias imagens sem lista a jusante,
  // cria uma lista automaticamente com elas.
  const syncListsAfterGeneration = useCallback(
    (finishedNodeId: string) => {
      const curNodes = getNodes();
      const curEdges = getEdges();
      const finished = curNodes.find((x) => x.id === finishedNodeId);
      const stack = generatedStackOf(finished);
      if (!finished || stack.length === 0) return;

      const listTargets = new Set(
        curEdges
          .filter((e) => e.source === finishedNodeId)
          .map((e) => e.target)
          .filter((t) => curNodes.find((x) => x.id === t)?.type === "listaImagens")
      );

      const updated = curNodes.map((n) =>
        listTargets.has(n.id) ? withSourceItems(n, finishedNodeId, stack) : n
      );

      if (stack.length > 1 && listTargets.size === 0) {
        const listId = `listaImagens-${Date.now()}`;
        const listNode: Node = {
          id: listId,
          type: "listaImagens",
          position: { x: finished.position.x + 360, y: finished.position.y },
          data: {
            label: "Geradas",
            mode: "list",
            items: stack,
            itemSources: Object.fromEntries(stack.map((u) => [u, finishedNodeId])),
          } satisfies ListaImagensData,
        };
        setNodes([...updated, listNode]);
        setEdges((es) => [
          ...es,
          { id: `e-${finishedNodeId}-${listId}`, source: finishedNodeId, target: listId, ...EDGE_DEFAULTS },
        ]);
      } else {
        setNodes(updated);
      }
      scheduleAutoSave();
    },
    [getNodes, getEdges, setNodes, setEdges, scheduleAutoSave, generatedStackOf, withSourceItems]
  );

  // ─── Hidrata resultados já existentes ao montar ───────────────────────
  // O Realtime abaixo só reage a eventos NOVOS depois que o canal abre — ele
  // nunca busca o estado atual do banco. Sem isto, toda vez que a página do
  // Space é recarregada (F5, navegar e voltar) as artes já geradas "somem":
  // o node volta a ficar vazio até a PRÓXIMA geração, mesmo com a arte
  // salva e intacta no art_version. Nenhuma arte gerada pode ficar invisível
  // assim — carrega o job/versão atual de cada node assim que o canvas monta.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data: jobs } = await supabase
        .from("art_generation_job")
        .select("id, art_index, status, created_at")
        .eq("demand_id", demanda.id)
        .order("created_at", { ascending: false });
      if (cancelled || !jobs?.length) return;

      // Job mais recente por art_index — pode haver duplicatas de antes da
      // dedupe em run/run-node (ver app/api/demands/[id]/flow/run*/route.ts).
      const jobByIndex = new Map<number, { id: string; status: string }>();
      for (const j of jobs) {
        if (!jobByIndex.has(j.art_index)) {
          jobByIndex.set(j.art_index, { id: j.id, status: j.status });
        }
      }

      const jobIds = Array.from(jobByIndex.values(), (j) => j.id);
      const { data: versions } = await supabase
        .from("art_version")
        .select("id, job_id, result_url, is_current, version_number, format")
        .in("job_id", jobIds)
        .order("version_number", { ascending: true });
      if (cancelled) return;

      const versionsByJob = new Map<string, NonNullable<typeof versions>>();
      for (const v of versions ?? []) {
        const list = versionsByJob.get(v.job_id) ?? [];
        list.push(v);
        versionsByJob.set(v.job_id, list);
      }

      setNodes((ns) =>
        ns.map((n) => {
          if (n.type !== "arte" && n.type !== "saidaArte") return n;
          const d = n.data as SaidaArteData;
          const job = jobByIndex.get(d.artIndex);
          if (!job) return n;

          const format = d.format === "story" ? "story" : "feed";
          const jobVersions = (versionsByJob.get(job.id) ?? []).filter(
            (v) => v.format === format && v.result_url
          );
          const status = job.status as SaidaArteData["generatingStatus"];
          if (jobVersions.length === 0) {
            return { ...n, data: { ...n.data, jobId: job.id, generatingStatus: status } };
          }
          const stack = jobVersions.map((v) => ({ versionId: v.id, url: v.result_url as string }));
          const current = jobVersions.find((v) => v.is_current);
          const resultUrl = current?.result_url ?? stack[stack.length - 1].url;
          return {
            ...n,
            data: { ...n.data, resultUrl, resultUrls: stack, jobId: job.id, generatingStatus: status },
          };
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [demanda.id, setNodes]);

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
              if (n.type !== "saidaArte" && n.type !== "arte") return n;
              if ((n.data as SaidaArteData).artIndex !== job.art_index) return n;
              return { ...n, data: { ...n.data, generatingStatus: status } };
            })
          );

          // Falha/pausa no meio de um lote pode ter deixado versões prontas.
          if (job.status === "succeeded" || job.status === "failed") {
            // art_version é inserido antes do job virar succeeded — seguro ler já.
            // Buscamos TODAS as versões (a pilha), não só a current.
            const { data: versions } = await supabase
              .from("art_version")
              .select("id, result_url, is_current, version_number")
              .eq("job_id", job.id)
              .eq("format", "feed")
              .order("version_number", { ascending: true });

            const stack = (versions ?? [])
              .filter((v) => v.result_url)
              .map((v) => ({ versionId: v.id as string, url: v.result_url as string }));

            if (stack.length > 0) {
              const current = (versions ?? []).find((v) => v.is_current);
              const resultUrl = (current?.result_url as string | undefined) ?? stack[stack.length - 1].url;
              let finishedNodeId: string | null = null;
              setNodes((ns) =>
                ns.map((n) => {
                  if (n.type !== "saidaArte" && n.type !== "arte") return n;
                  if ((n.data as SaidaArteData).artIndex !== job.art_index) return n;
                  finishedNodeId = n.id;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      resultUrl,
                      resultUrls: stack,
                      jobId: job.id,
                      generatingStatus: status,
                    },
                  };
                })
              );
              // Materializa listas conectadas + auto-cria lista se gerou várias.
              if (finishedNodeId) {
                const nodeId = finishedNodeId;
                setTimeout(() => syncListsAfterGeneration(nodeId), 60);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demanda.id, setNodes, syncListsAfterGeneration]);

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

    const arteCount = nodes.filter((n) => n.type === "arte").length;
    const data: Record<string, unknown> =
      type === "clienteLogo"
        ? { clientId: demanda.client_id ?? "", logoUrl: clientProfile?.logoUrl ?? null }
        : type === "clienteReferencias"
        ? { clientId: demanda.client_id ?? "", referenceUrls: clientProfile?.referenceUrls ?? [] }
        : type === "referenciaImagem"
        ? { imageUrl: null, label: "Imagem" }
        : type === "arte"
        ? {
            artIndex: arteCount,
            label: `Arte ${arteCount + 1}`,
            format: "feed",
            aspectRatio: "4:5",
            imageSize: IMAGE_GEN_DEFAULTS.imageSize,
            model: IMAGE_GEN_DEFAULTS.model,
            quality: "medium",
            count: 1,
            demandId: demanda.id,
            clientId: demanda.client_id ?? "",
          }
        : type === "listaImagens"
        ? { mode: "reference" }
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
          if (n.type !== "saidaArte" && n.type !== "arte") return n;
          // Stories não roda no "Executar" geral — disparo é no próprio node.
          if ((n.data as SaidaArteData).format === "story") return n;
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
    if (n.type !== "saidaArte" && n.type !== "arte") return false;
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

    // Piso em ARTE_ROW_Y - ROW_H: com só logo/refs sobrando, +ROW_H cai em
    // ARTE_ROW_Y — a linha de artes sempre abaixo do bloco logo/refs, nunca
    // por cima dele (ver mesma lógica em generator.ts:maxContentY).
    const maxY = keptNodes.reduce((max, n) => {
      if (n.type === "clienteLogo" || n.type === "clienteReferencias") return max;
      return Math.max(max, n.position.y);
    }, ARTE_ROW_Y - ROW_H);
    const yOffset = maxY + ROW_H;

    const subGraph = gerarSubfluxoDaDemanda(demanda, numArtes, { logoId, refsId, yOffset });
    const { nodes: newNodes, edges: newEdges } = graphToRF(subGraph);

    setNodes([...keptNodes, ...newNodes]);
    setEdges([...keptEdges, ...newEdges]);
    toast.info("Fluxo desta demanda redefinido para o padrão");
    scheduleAutoSave();
  }

  // ─── Context menu (botão direito num node) ──────────────────────────────

  function onNodeContextMenu(event: React.MouseEvent, node: Node) {
    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    setNodeMenu({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
      nodeId: node.id,
    });
  }

  function deleteNode(nodeId: string) {
    purgeListItems(getEdges().filter((e) => e.source === nodeId));
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setNodeMenu(null);
    scheduleAutoSave();
  }

  function duplicateNode(nodeId: string) {
    const node = getNodes().find((n) => n.id === nodeId);
    setNodeMenu(null);
    if (!node) return;
    const copy: Node = {
      ...node,
      id: `${node.type}-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
      data: { ...node.data },
    };
    setNodes((ns) => [...ns, copy]);
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
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={() => setNodeMenu(null)}
            onMoveStart={() => setNodeMenu(null)}
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

        {/* Context menu (botão direito num node) */}
        {nodeMenu && (
          <div
            className="absolute z-20 min-w-40 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[var(--surface-shadow-elevated)]"
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={() => duplicateNode(nodeMenu.nodeId)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Copy className="size-3.5 text-muted-foreground" />
              Duplicar nó
            </button>
            <button
              type="button"
              onClick={() => deleteNode(nodeMenu.nodeId)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-tone-red transition-colors hover:bg-tone-red/10"
            >
              <Trash2 className="size-3.5" />
              Excluir nó
            </button>
          </div>
        )}

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
