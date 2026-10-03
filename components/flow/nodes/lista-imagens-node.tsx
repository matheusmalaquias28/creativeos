"use client";

import { Handle, Position, useEdges, useReactFlow } from "@xyflow/react";
import { ListChecks, ImageIcon } from "lucide-react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeImagePlaceholder,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { NodeThumb } from "@/components/flow/nodes/node-image";
import { cn } from "@/lib/utils";
import type {
  ClienteReferenciasData,
  ListaImagensData,
  ReferenciaImagemData,
  SaidaArteData,
} from "@/lib/flow/types";

type Props = { id: string; data: ListaImagensData; selected?: boolean };

type IncomingImage = { url: string; sourceId: string };

/** Imagens que chegam na lista (estáticas ou já geradas), com o node de origem. */
function useIncomingImages(id: string): IncomingImage[] {
  const edges = useEdges();
  const { getNode } = useReactFlow();
  const out: IncomingImage[] = [];
  for (const edge of edges) {
    if (edge.target !== id) continue;
    const node = getNode(edge.source);
    if (!node) continue;
    const push = (url?: string | null) => {
      if (url) out.push({ url, sourceId: edge.source });
    };
    if (node.type === "referenciaImagem") push((node.data as ReferenciaImagemData).imageUrl);
    else if (node.type === "clienteReferencias")
      (node.data as ClienteReferenciasData).referenceUrls?.forEach(push);
    else if (node.type === "clienteLogo") push((node.data as { logoUrl?: string | null }).logoUrl);
    else if (node.type === "saidaArte" || node.type === "arte")
      push((node.data as SaidaArteData).resultUrl);
  }
  return out;
}

export function ListaImagensNode({ id, data, selected }: Props) {
  const { setNodes, setEdges } = useReactFlow();
  const { scheduleAutoSave } = useFlowCanvas();
  const images = useIncomingImages(id);
  const mode = data.mode ?? "reference";

  function setMode(next: "reference" | "list") {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, mode: next } } : n))
    );
    scheduleAutoSave();
  }

  // "Joga para fora": desconecta a origem daquela imagem da lista.
  function detach(sourceId: string) {
    setEdges((es) => es.filter((e) => !(e.target === id && e.source === sourceId)));
    scheduleAutoSave();
  }

  return (
    <NodeShell
      tone={FLOW_NODE_TONE.listaImagens}
      icon={ListChecks}
      title="Lista"
      selected={selected}
      className="w-60"
      meta={
        images.length > 0 && (
          <span className="rounded-md bg-muted px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-muted-foreground">
            {images.length}
          </span>
        )
      }
    >
      <Handle type="target" position={Position.Left} className={flowHandleClass} />

      {/* Modo: referência (1 geração) vs lista (fan-out, 1 por item) */}
      <div className="mb-2 flex overflow-hidden rounded-lg border border-border">
        {(["reference", "list"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "nodrag flex-1 px-2 py-1 text-[0.625rem] font-semibold transition-premium",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
            title={
              m === "reference"
                ? "Usar todas as imagens como referência de 1 geração"
                : "Fan-out: gerar 1 imagem por item da lista"
            }
          >
            {m === "reference" ? "Referência" : "Lista"}
          </button>
        ))}
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((img, i) => (
            <NodeThumb
              key={`${img.sourceId}-${i}`}
              url={img.url}
              alt={`Item ${i + 1}`}
              onPopOut={() => detach(img.sourceId)}
            />
          ))}
        </div>
      ) : (
        <NodeImagePlaceholder icon={ImageIcon} className="aspect-video">
          <span className="text-[0.625rem] text-muted-foreground">Conecte imagens</span>
        </NodeImagePlaceholder>
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
