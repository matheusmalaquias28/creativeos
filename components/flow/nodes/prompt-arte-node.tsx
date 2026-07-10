"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, useReactFlow, useEdges } from "@xyflow/react";
import { FileText } from "lucide-react";
import { useFlowCanvas } from "@/components/flow/flow-canvas-context";
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
    <div
      className={`w-64 rounded-xl border bg-amber-500/5 p-3 backdrop-blur-sm transition-colors ${
        selected
          ? "border-amber-500/50 shadow-[0_0_0_2px_oklch(0.7_0.18_85/15%)]"
          : "border-amber-500/20"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-amber-500/50 !bg-amber-500/30"
      />

      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex size-5 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/15">
          <FileText className="size-3 text-amber-400" strokeWidth={1.5} />
        </div>
        <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-amber-400">
          Arte #{data.artIndex + 1}
        </span>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          className="nodrag w-full resize-none rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 font-mono text-[0.6875rem] leading-relaxed text-foreground/80 placeholder:text-muted-foreground/30 focus:border-amber-500/40 focus:outline-none"
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
          <div className="nodrag nopan absolute bottom-full left-0 z-50 mb-1 w-full overflow-hidden rounded-lg border border-rose-500/30 bg-[oklch(0.09_0.007_265/96%)] shadow-xl backdrop-blur-md">
            <p className="px-2.5 pb-1 pt-1.5 text-[0.5rem] uppercase tracking-widest text-muted-foreground/40">
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
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                  idx === mentionIdx
                    ? "bg-rose-500/15 text-rose-300"
                    : "text-muted-foreground/60 hover:bg-white/5"
                }`}
              >
                <span className="font-mono text-[0.625rem] text-rose-400/90">
                  {token}
                </span>
                <span className="ml-auto text-[0.5625rem] text-muted-foreground/40">
                  {label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[0.5625rem] text-muted-foreground/35">
        Edite direto · @ para referências · salva ao sair do campo
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-amber-500/50 !bg-amber-500/30"
      />
    </div>
  );
}
