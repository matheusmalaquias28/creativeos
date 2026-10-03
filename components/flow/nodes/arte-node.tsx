"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useEdges } from "@xyflow/react";
import {
  Sparkles,
  Play,
  Pause,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { ImageLightbox } from "@/components/flow/nodes/node-image";
import { NodeSelect } from "@/components/flow/nodes/node-select";
import {
  getPromptArteEditorText,
  parsePromptArteText,
} from "@/lib/flow/prompt-arte-text";
import { cn } from "@/lib/utils";
import type { ArteData, ClienteLogoData, ReferenciaImagemData } from "@/lib/flow/types";

type Props = { id: string; data: ArteData; selected?: boolean };

const ASPECT_OPTIONS = ["4:5", "9:16", "1:1", "3:4", "16:9"];
const QUALITY_OPTIONS = ["low", "medium", "high"] as const;
const SIZE_OPTIONS = ["1K", "2K", "4K"];
const COUNT_OPTIONS = [1, 2, 3, 4, 6];

/** "4:5" → "4 / 5" para o CSS aspect-ratio. */
function aspectCss(aspect: string | undefined): string {
  const [w, h] = (aspect ?? "4:5").split(":");
  return `${w || 4} / ${h || 5}`;
}

function detectMention(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const frag = before.slice(at + 1);
  if (/[\s\n]/.test(frag) || frag.startsWith("(")) return null;
  return { start: at, query: frag };
}

export function ArteNode({ id, data, selected }: Props) {
  const { setNodes, getNode } = useReactFlow();
  const { scheduleAutoSave, saveNow } = useFlowCanvas();
  const edges = useEdges();
  const isStory = data.format === "story";

  // ─── Prompt (colapsável) ─────────────────────────────────────────────
  const [promptOpen, setPromptOpen] = useState(false);
  const [draft, setDraft] = useState(() => getPromptArteEditorText(data));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  useEffect(() => {
    if (taRef.current === document.activeElement) return;
    setDraft(getPromptArteEditorText(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.promptText, data.headline, data.subheadline, data.cta, data.informacoesExtras]);

  const commit = useCallback(
    (text: string, persist?: boolean) => {
      const parsed = parsePromptArteText(text, data.artIndex, data);
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...parsed } } : n)));
      if (persist) void saveNow();
      else scheduleAutoSave();
    },
    [data, id, saveNow, scheduleAutoSave, setNodes]
  );

  const scheduleCommit = useCallback((text: string) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(text), 400);
  }, [commit]);

  useEffect(() => () => { if (commitTimer.current) clearTimeout(commitTimer.current); }, []);

  // Referências mencionáveis (@): nodes conectados à entrada deste node.
  const mentionable = edges
    .filter((e) => e.target === id)
    .map((e) => getNode(e.source))
    .filter((n): n is NonNullable<typeof n> => n != null)
    .flatMap((n) => {
      if (n.type === "referenciaImagem") {
        const label = (n.data as ReferenciaImagemData).label || "imagem";
        return [{ label, token: `@(${label.toLowerCase().replace(/\s+/g, "-")})` }];
      }
      if (n.type === "clienteLogo" && (n.data as ClienteLogoData).logoUrl) {
        return [{ label: "logo", token: "@(logo)" }];
      }
      return [];
    });
  const mentionOpts = mention
    ? mentionable.filter((m) => m.label.toLowerCase().includes(mention.query.toLowerCase()))
    : [];
  const showMention = mention !== null && mentionOpts.length > 0;

  function pickMention(token: string, query: string, start: number) {
    const next = draft.slice(0, start) + token + draft.slice(start + 1 + query.length);
    setDraft(next);
    setMention(null);
    scheduleCommit(next);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); const p = start + token.length; el.setSelectionRange(p, p); }
    });
  }

  // ─── Controles ────────────────────────────────────────────────────────
  function update(patch: Partial<ArteData>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    scheduleAutoSave();
  }

  // ─── Geração (in-node) ──────────────────────────────────────────────────
  const [triggering, setTriggering] = useState(false);
  const status = data.generatingStatus;
  const isGenerating = status === "queued" || status === "processing";

  async function handleGenerate() {
    if (!data.demandId) { toast.error("Salve o fluxo antes de gerar"); return; }
    setTriggering(true);
    try {
      const res = await fetch(`/api/demands/${data.demandId}/flow/run-node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artIndex: data.artIndex }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Erro");
      update({ generatingStatus: "queued" });
    } catch (err) {
      toast.error("Erro ao gerar", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setTriggering(false);
    }
  }

  async function handlePause() {
    if (!data.demandId) return;
    try {
      await fetch(`/api/art-gen/cancel-demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId: data.demandId }),
      });
      update({ generatingStatus: "failed" });
    } catch {
      /* best-effort */
    }
  }

  // ─── Pilha de resultados ────────────────────────────────────────────────
  const stack = data.resultUrls?.length
    ? data.resultUrls
    : data.resultUrl
      ? [{ versionId: "current", url: data.resultUrl }]
      : [];
  const [idx, setIdx] = useState(stack.length - 1);
  useEffect(() => { setIdx(Math.max(0, stack.length - 1)); }, [stack.length]);
  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, stack.length - 1));
  const current = stack[safeIdx];
  const [lightbox, setLightbox] = useState(false);

  function download() {
    if (!current) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = `${(data.label ?? `arte-${data.artIndex + 1}`).replace(/\s+/g, "-").toLowerCase()}-${safeIdx + 1}.png`;
    a.target = "_blank";
    a.click();
  }

  return (
    <NodeShell
      tone={FLOW_NODE_TONE.arte}
      icon={Sparkles}
      iconNode={isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : undefined}
      title={data.label ?? `Arte ${data.artIndex + 1}`}
      selected={selected}
      className="w-72"
      meta={
        isGenerating ? (
          <button
            onClick={handlePause}
            title="Pausar geração"
            className="nodrag flex size-6 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-premium hover:border-tone-red/50 hover:text-tone-red"
          >
            <Pause className="size-3" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={triggering}
            title="Gerar"
            className="nodrag flex size-6 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-premium hover:border-primary/50 hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            {triggering ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-2.5 fill-current" />}
          </button>
        )
      }
    >
      {/* Entradas: logo / refs / lista */}
      {!isStory && (
        <>
          <Handle type="target" position={Position.Left} id="logo" style={{ top: "22%" }}
            className={cn(flowHandleClass, "!bg-tone-blue")} title="Logo" />
          <Handle type="target" position={Position.Left} id="refs" style={{ top: "50%" }}
            className={cn(flowHandleClass, "!bg-tone-violet")} title="Referências" />
        </>
      )}
      {isStory && (
        <Handle type="target" position={Position.Left} id="refs"
          className={cn(flowHandleClass, "!bg-tone-cyan")} title="Lista" />
      )}

      {/* Preview no formato selecionado */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-surface"
        style={{ aspectRatio: aspectCss(data.aspectRatio) }}
      >
        {current ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={data.label ?? ""}
              onDoubleClick={() => setLightbox(true)}
              className="nodrag size-full cursor-zoom-in object-cover"
            />
            {stack.length > 1 && (
              <>
                <button type="button" onClick={() => setIdx((i) => (i - 1 + stack.length) % stack.length)}
                  className="nodrag absolute left-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur hover:bg-card">
                  <ChevronLeft className="size-3.5" />
                </button>
                <button type="button" onClick={() => setIdx((i) => (i + 1) % stack.length)}
                  className="nodrag absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur hover:bg-card">
                  <ChevronRight className="size-3.5" />
                </button>
                <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-md bg-card/80 px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-foreground backdrop-blur">
                  {safeIdx + 1}/{stack.length}
                </span>
              </>
            )}
            <button type="button" onClick={download} title="Baixar"
              className="nodrag absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-lg border border-border bg-card/80 text-foreground backdrop-blur hover:border-primary/50 hover:bg-primary hover:text-primary-foreground">
              <Download className="size-3" />
            </button>
          </>
        ) : isGenerating ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-tone-blue/8">
            <Loader2 className="size-6 animate-spin text-tone-blue" />
            <span className="text-[0.625rem] font-medium text-tone-blue">
              {status === "queued" ? "na fila…" : "gerando…"}
            </span>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
            <ImageIcon className="size-6" strokeWidth={1.5} />
            <span className="text-[0.625rem]">{data.aspectRatio ?? "4:5"}</span>
          </div>
        )}
      </div>

      {/* Controles sutis */}
      <div className="mt-2 flex items-center gap-1">
        <NodeSelect title="Formato" className="flex-1" value={data.aspectRatio ?? "4:5"}
          options={ASPECT_OPTIONS.map((v) => ({ value: v, label: v }))}
          onChange={(v) => update({ aspectRatio: v })} />
        <NodeSelect title="Esforço" className="flex-1" value={data.quality ?? "medium"}
          options={QUALITY_OPTIONS.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
          onChange={(v) => update({ quality: v as ArteData["quality"] })} />
        <NodeSelect title="Resolução" className="flex-1" value={data.imageSize ?? "2K"}
          options={SIZE_OPTIONS.map((v) => ({ value: v, label: v }))}
          onChange={(v) => update({ imageSize: v })} />
        <NodeSelect title="Quantidade" className="w-12" value={String(data.count ?? 1)}
          options={COUNT_OPTIONS.map((v) => ({ value: String(v), label: `${v}×` }))}
          onChange={(v) => update({ count: Number(v) })} />
      </div>

      {/* Prompt colapsável */}
      {(
        <div className="relative mt-2">
          {promptOpen ? (
            <textarea
              ref={taRef}
              autoFocus
              value={draft}
              rows={4}
              placeholder={"Headline: …\nSubheadline: …\nCTA: …\nExtras: @referência"}
              onChange={(e) => {
                const v = e.target.value;
                setDraft(v);
                setMention(detectMention(v, e.target.selectionStart ?? v.length));
                setMentionIdx(0);
                scheduleCommit(v);
              }}
              onBlur={() => {
                if (commitTimer.current) clearTimeout(commitTimer.current);
                commit(draftRef.current, true);
                setMention(null);
                setPromptOpen(false);
              }}
              onKeyDown={(e) => {
                if (showMention) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionOpts.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionOpts.length) % mentionOpts.length); return; }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const o = mentionOpts[mentionIdx];
                    if (o && mention) pickMention(o.token, mention.query, mention.start);
                    return;
                  }
                  if (e.key === "Escape") { e.stopPropagation(); setMention(null); return; }
                }
              }}
              className="nodrag nowheel w-full resize-none rounded-xl border border-primary/50 bg-input p-2 font-mono text-[0.6875rem] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPromptOpen(true)}
              className="nodrag w-full truncate rounded-xl border border-border bg-input/60 p-2 text-left text-[0.6875rem] text-muted-foreground transition-premium hover:border-border-strong"
              title="Editar prompt"
            >
              {draft.trim() ? draft.split("\n")[0] : "Escrever prompt…"}
            </button>
          )}

          {showMention && (
            <div className="nodrag nopan absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[var(--surface-shadow-elevated)]">
              {mentionOpts.map((o, i) => (
                <button key={o.token} type="button"
                  onMouseDown={(e) => { e.preventDefault(); if (mention) pickMention(o.token, mention.query, mention.start); }}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left", i === mentionIdx ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60")}>
                  <span className="font-mono text-[0.625rem] font-semibold text-tone-orange">{o.token}</span>
                  <span className="ml-auto truncate text-[0.625rem] text-muted-foreground">{o.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className={flowHandleClass} />

      {lightbox && current && <ImageLightbox url={current.url} onClose={() => setLightbox(false)} />}
    </NodeShell>
  );
}
