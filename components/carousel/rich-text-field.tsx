"use client";

import { useEffect, useRef, useState } from "react";
import { Italic, Baseline, PaintBucket, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS } from "@/lib/design/fonts";
import { sanitizeRichHtml, hasRichContent } from "@/lib/carousel/sanitize-html";
import { PRESET_COLORS } from "@/components/carousel/controls/pickers";

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

/** Small popover to pick a color (or clear) — used inside the toolbar. */
function MiniColor({
  icon,
  title,
  onPick,
  onClear,
}: {
  icon: React.ReactNode;
  title: string;
  onPick: (color: string) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-40 w-52 rounded-xl border border-border bg-card p-2.5 shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
          <div className="grid grid-cols-9 gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(c); setOpen(false); }}
                className="size-5 rounded border border-white/10 transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          {onClear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onClear(); setOpen(false); }}
              className="mt-2 w-full rounded-lg border border-border px-2 py-1 text-[0.625rem] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Remover
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
        {/* Font family */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFontOpen((o) => !o)}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[0.625rem] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            title="Fonte"
          >
            Fonte ▾
          </button>
          {fontOpen && (
            <div className="absolute left-0 top-9 z-40 max-h-56 w-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { applyStyle({ fontFamily: f.family }); setFontOpen(false); }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-muted/60"
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
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[0.625rem] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            title="Peso"
          >
            Peso ▾
          </button>
          {weightOpen && (
            <div className="absolute left-0 top-9 z-40 w-36 rounded-xl border border-border bg-card p-1 shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
              {WEIGHTS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { applyStyle({ fontWeight: w.value }); setWeightOpen(false); }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-muted/60"
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
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Italic className="size-3.5" />
        </button>

        <MiniColor
          icon={<Baseline className="size-3.5" />}
          title="Cor do texto"
          onPick={(c) => applyStyle({ color: c })}
        />
        <MiniColor
          icon={<PaintBucket className="size-3.5" />}
          title="Cor de fundo do trecho"
          onPick={(c) => applyStyle({ backgroundColor: c })}
          onClear={() => applyStyle({ backgroundColor: "transparent" })}
        />

        <button
          type="button"
          title="Limpar formatação"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormatting}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Eraser className="size-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setApplyAll((v) => !v)}
          className={cn(
            "ml-auto rounded-md px-2 py-1 text-[0.5625rem] font-semibold uppercase tracking-wider transition-colors",
            applyAll
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground/60 hover:text-foreground"
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
          "rich-text-editable w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-xs leading-relaxed outline-none",
          "focus:border-primary/50 focus:ring-1 focus:ring-primary/30",
          "empty:before:text-muted-foreground/40 empty:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  );
}
