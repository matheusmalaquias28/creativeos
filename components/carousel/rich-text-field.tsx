"use client";

import { useEffect, useRef, useState } from "react";
import { Italic, Baseline, ChevronDown, PaintBucket, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS } from "@/lib/design/fonts";
import { sanitizeRichHtml, hasRichContent } from "@/lib/carousel/sanitize-html";
import { PRESET_COLORS } from "@/components/carousel/controls/pickers";
import { ColorMenuButton } from "@/components/carousel/controls/color-menu";

const WEIGHTS = [
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "Black", value: "900" },
];

type RichTextFieldProps = {
  html?: string | null;
  plain: string;
  placeholder?: string;
  rows?: number;
  onChange: (next: { html: string | null; plain: string }) => void;
};

export function RichTextField({
  html,
  plain,
  placeholder,
  rows = 2,
  onChange,
}: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [applyAll, setApplyAll] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  // Initialize content once on mount (component is keyed by slide+field upstream).
  useEffect(() => {
    if (!editorRef.current) return;
    if (hasRichContent(html)) {
      editorRef.current.innerHTML = html!;
    } else {
      editorRef.current.textContent = plain ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the last selection made inside the editor.
  useEffect(() => {
    function onSelChange() {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  function serialize() {
    const el = editorRef.current;
    if (!el) return;
    const clean = sanitizeRichHtml(el.innerHTML);
    const text = el.textContent ?? "";
    onChange({ html: hasRichContent(clean) ? clean : null, plain: text });
  }

  /** Point the live selection at the working range (selection or whole text). */
  function focusWorkingRange(): Range | null {
    const el = editorRef.current;
    const sel = document.getSelection();
    if (!el || !sel) return null;
    el.focus();

    let range: Range;
    if (applyAll) {
      range = document.createRange();
      range.selectNodeContents(el);
    } else if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      range = savedRange.current.cloneRange();
      if (range.collapsed) range.selectNodeContents(el);
    } else {
      range = document.createRange();
      range.selectNodeContents(el);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    return range;
  }

  function applyStyle(style: Partial<CSSStyleDeclaration>) {
    const range = focusWorkingRange();
    const sel = document.getSelection();
    if (!range || !sel || range.collapsed) return;
    const span = document.createElement("span");
    Object.assign(span.style, style);
    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      sel.removeAllRanges();
      const nr = document.createRange();
      nr.selectNodeContents(span);
      sel.addRange(nr);
      savedRange.current = nr.cloneRange();
    } catch {
      // ignore ranges that can't be surrounded
    }
    serialize();
  }

  function toggleItalic() {
    focusWorkingRange();
    document.execCommand("italic");
    serialize();
  }

  function clearFormatting() {
    focusWorkingRange();
    document.execCommand("removeFormat");
    serialize();
  }

  return (
    <div className="space-y-1.5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-1">
        {/* Font family */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFontOpen((o) => !o)}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Fonte"
          >
            Fonte
            <ChevronDown className="size-3" />
          </button>
          {fontOpen && (
            <div className="absolute left-0 top-9 z-40 max-h-56 w-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-[var(--surface-shadow-elevated)]">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { applyStyle({ fontFamily: f.family }); setFontOpen(false); }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  style={{ fontFamily: f.family }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Weight */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setWeightOpen((o) => !o)}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Peso"
          >
            Peso
            <ChevronDown className="size-3" />
          </button>
          {weightOpen && (
            <div className="absolute left-0 top-9 z-40 w-36 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-[var(--surface-shadow-elevated)]">
              {WEIGHTS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { applyStyle({ fontWeight: w.value }); setWeightOpen(false); }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  style={{ fontWeight: w.value as React.CSSProperties["fontWeight"] }}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          title="Itálico"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleItalic}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Italic className="size-3.5" />
        </button>

        <ColorMenuButton
          icon={<Baseline className="size-3.5" />}
          title="Cor do texto"
          presets={PRESET_COLORS}
          onPick={(c) => applyStyle({ color: c })}
        />
        <ColorMenuButton
          icon={<PaintBucket className="size-3.5" />}
          presets={PRESET_COLORS}
          title="Cor de fundo do trecho"
          onPick={(c) => applyStyle({ backgroundColor: c })}
          onClear={() => applyStyle({ backgroundColor: "transparent" })}
        />

        <button
          type="button"
          title="Limpar formatação"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormatting}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Eraser className="size-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setApplyAll((v) => !v)}
          className={cn(
            "ml-auto h-7 rounded-md px-2 text-[0.6875rem] font-semibold transition-colors",
            applyAll
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Aplicar formatação ao texto todo ou só à seleção"
        >
          {applyAll ? "Tudo" : "Seleção"}
        </button>
      </div>

      {/* Editable surface */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={serialize}
        data-placeholder={placeholder}
        style={{ minHeight: rows * 22 + 16 }}
        className={cn(
          "rich-text-editable w-full rounded-xl border border-border bg-input px-3 py-2 text-xs leading-relaxed text-foreground outline-none transition-premium",
          "hover:border-border-strong focus:border-primary/60 focus:ring-3 focus:ring-ring/20",
          "empty:before:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  );
}
