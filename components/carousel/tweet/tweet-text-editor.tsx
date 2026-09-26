"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, Baseline, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeRichHtml } from "@/lib/carousel/sanitize-html";
import { ColorMenuButton } from "@/components/carousel/controls/color-menu";

const TEXT_COLORS = [
  "#0f1419", "#536471", "#ffffff", "#1d9bf0", "#00ba7c", "#f91880", "#7856ff", "#ff7a00",
  "#ffd400", "#f4212e", "#0a66c2", "#16a34a", "#db2777", "#9333ea", "#ea580c", "#ca8a04",
];

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * Editor rich text do card. Não controlado: o HTML inicial é aplicado no mount
 * (o componente é keyed pelo id do card) e cada alteração é serializada.
 */
export function TweetTextEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda a última seleção dentro do editor (o seletor de cor nativo rouba o foco).
  useEffect(() => {
    function onSelChange() {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (ref.current?.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  function serialize() {
    if (!ref.current) return;
    onChange(sanitizeRichHtml(ref.current.innerHTML));
  }

  function exec(command: string, value?: string, css = false) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = document.getSelection();
    if (sel && savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("styleWithCSS", false, css ? "true" : "false");
    document.execCommand(command, false, value);
    serialize();
  }

  return (
    <div className="overflow-visible rounded-xl border border-border bg-input transition-premium focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-ring/20">
      <div className="flex items-center gap-0.5 border-b border-border p-1">
        <ToolButton title="Negrito" onClick={() => exec("bold")}>
          <Bold className="size-4" />
        </ToolButton>
        <ToolButton title="Itálico" onClick={() => exec("italic")}>
          <Italic className="size-4" />
        </ToolButton>
        <ToolButton title="Sublinhado" onClick={() => exec("underline")}>
          <Underline className="size-4" />
        </ToolButton>

        <ColorMenuButton
          icon={<Baseline className="size-4" />}
          title="Cor do texto"
          presets={TEXT_COLORS}
          onPick={(c) => exec("foreColor", c, true)}
          buttonClassName="size-8"
        />

        <ToolButton title="Limpar formatação" onClick={() => exec("removeFormat")}>
          <Eraser className="size-4" />
        </ToolButton>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={serialize}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        data-placeholder="Escreva o texto do card…"
        className={cn(
          "min-h-28 w-full px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none",
          "empty:before:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  );
}
