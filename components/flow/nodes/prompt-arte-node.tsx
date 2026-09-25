"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, useReactFlow, useEdges } from "@xyflow/react";
import { FileText } from "lucide-react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
import {
  FLOW_NODE_TONE,
  NodeShell,
  flowHandleClass,
} from "@/components/flow/nodes/node-shell";
import { tones } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import {
  formatPromptArteData,
  getPromptArteEditorText,
  parsePromptArteText,
} from "@/lib/flow/prompt-arte-text";
import type { ClienteLogoData, PromptArteData, ReferenciaImagemData } from "@/lib/flow/types";

// ─── Mention detection ────────────────────────────────────────────────────

function detectMention(
  text: string,
  cursorPos: number
): { start: number; query: string } | null {
  const before = text.slice(0, cursorPos);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;
  const fragment = before.slice(atIdx + 1);
  if (/[\s\n]/.test(fragment) || fragment.startsWith("(")) return null;
  return { start: atIdx, query: fragment };
}

// ─── Component ────────────────────────────────────────────────────────────

type Props = { id: string; data: PromptArteData; selected?: boolean };

export function PromptArteNode({ id, data, selected }: Props) {
  const { setNodes, getNode } = useReactFlow();
  const { scheduleAutoSave, saveNow } = useFlowCanvas();
  const edges = useEdges();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");

  const [draft, setDraft] = useState(() => getPromptArteEditorText(data));
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  draftRef.current = draft;

  useEffect(() => {
    if (textareaRef.current === document.activeElement) return;
    setDraft(getPromptArteEditorText(data));
  }, [
    data.promptText,
    data.headline,
    data.subheadline,
    data.cta,
    data.informacoesExtras,
    data.artIndex,
  ]);

  const connectedSourceNodes = edges
    .filter((e) => e.target === id)
    .map((e) => getNode(e.source))
    .filter((n): n is NonNullable<typeof n> => n != null);

  const connectedImages = connectedSourceNodes
    .filter((n) => n.type === "referenciaImagem")
    .map((n) => {
      const imgData = n.data as ReferenciaImagemData;
      const label = imgData.label || "imagem";
      const token = `@(${label.toLowerCase().replace(/\s+/g, "-")})`;
      return { label, token };
    })
    .concat(
      // Logo do cliente conectada ao node de texto também vira mencionável (@(logo)).
      connectedSourceNodes
        .filter((n) => n.type === "clienteLogo" && (n.data as ClienteLogoData).logoUrl)
        .map(() => ({ label: "logo", token: "@(logo)" }))
    );

  const mentionOptions =
    mention !== null
      ? connectedImages.filter(({ label }) =>
          label.toLowerCase().includes(mention.query.toLowerCase())
        )
      : [];
  const showMention = mention !== null && mentionOptions.length > 0;

  const commit = useCallback(
    (text: string, options?: { persist?: boolean }) => {
      const parsed = parsePromptArteText(text, data.artIndex, data);
      setNodes((nodes) =>
        nodes.map((n) => (n.id === id ? { ...n, data: parsed } : n))
      );

      if (options?.persist) {
        void saveNow();
      } else {
        scheduleAutoSave();
      }
    },
    [data, id, saveNow, scheduleAutoSave, setNodes]
  );

  const scheduleCommit = useCallback(
    (text: string) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => commit(text), 400);
    },
    [commit]
  );

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  const selectMention = useCallback(
    (token: string, query: string, start: number) => {
      const before = draft.slice(0, start);
      const after = draft.slice(start + 1 + query.length);
      const next = before + token + after;
      setDraft(next);
      setMention(null);
      setMentionIdx(0);
      scheduleCommit(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const pos = start + token.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [draft, scheduleCommit]
  );

  const handleBlur = useCallback(() => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commit(draftRef.current, { persist: true });
    setMention(null);
  }, [commit]);

  return (
    <NodeShell
      tone={FLOW_NODE_TONE.promptArte}
      icon={FileText}
      title={`Prompt · Arte #${data.artIndex + 1}`}
      selected={selected}
      className="w-64"
      meta={
        connectedImages.length > 0 && (
          <span
            className={cn(
              "rounded-md border px-1.5 py-px text-[0.625rem] font-bold tabular-nums",
              tones[FLOW_NODE_TONE.referenciaImagem].badge
            )}
            title="Referências mencionáveis com @"
          >
            @{connectedImages.length}
          </span>
        )
      }
    >
      <Handle type="target" position={Position.Left} className={flowHandleClass} />

      <div className="relative">
        <textarea
          ref={textareaRef}
          className="nodrag w-full resize-none rounded-xl border border-border bg-input p-2.5 font-mono text-[0.6875rem] leading-relaxed text-foreground placeholder:text-muted-foreground/60 transition-premium hover:border-border-strong focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
          rows={5}
          value={draft}
          placeholder={"Headline: texto\nSubheadline: texto\nCTA: texto\nExtras: @referencia"}
          onChange={(e) => {
            const val = e.target.value;
            setDraft(val);
            const pos = e.target.selectionStart ?? val.length;
            setMention(detectMention(val, pos));
            setMentionIdx(0);
            scheduleCommit(val);
          }}
          onSelect={(e) => {
            const pos =
              (e.target as HTMLTextAreaElement).selectionStart ?? draft.length;
            setMention(detectMention(draft, pos));
            setMentionIdx(0);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (showMention && mentionOptions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIdx((i) => (i + 1) % mentionOptions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIdx(
                  (i) => (i - 1 + mentionOptions.length) % mentionOptions.length
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const opt = mentionOptions[mentionIdx];
                if (opt && mention)
                  selectMention(opt.token, mention.query, mention.start);
                return;
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setMention(null);
                return;
              }
            }
          }}
        />

        {showMention && (
          <div className="nodrag nopan absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[var(--surface-shadow-elevated)]">
            <p className="px-2 pb-1 pt-1 text-[0.625rem] font-semibold text-muted-foreground">
              Referências conectadas
            </p>
            {mentionOptions.map(({ label, token }, idx) => (
              <button
                key={token}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (mention) selectMention(token, mention.query, mention.start);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                  idx === mentionIdx
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60"
                )}
              >
                <span className="font-mono text-[0.625rem] font-semibold text-tone-orange">
                  {token}
                </span>
                <span className="ml-auto truncate text-[0.625rem] text-muted-foreground">
                  {label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-2 text-[0.625rem] leading-snug text-muted-foreground">
        Edite direto · @ para referências · salva ao sair do campo
      </p>

      <Handle type="source" position={Position.Right} className={flowHandleClass} />
    </NodeShell>
  );
}
