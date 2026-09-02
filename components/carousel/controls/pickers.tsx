"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pipette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS } from "@/lib/design/fonts";

export const PRESET_COLORS = [
  "#000000", "#0a0a0a", "#111111", "#1a1a2e", "#0d1117", "#1c1c1e",
  "#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1",
  "#e2e8f0", "#f1f5f9", "#f8fafc", "#ffffff", "#fef9c3", "#fef3c7",
  "#3b82f6", "#2563eb", "#8b5cf6", "#7c3aed", "#ec4899", "#db2777",
  "#10b981", "#059669", "#f59e0b", "#d97706", "#ef4444", "#dc2626",
  "#06b6d4", "#0891b2", "#84cc16", "#65a30d", "#f97316", "#ea580c",
];

// ─── Anchored popover positioning ──────────────────────────────────────────
// The picker panels used to be `position: absolute` inside the sidebar, which
// has `overflow-y-auto` (so overflow-x is clipped). Panels wider than the
// sidebar got hidden. We render them in a portal with fixed positioning,
// clamped to the viewport, so they always show in full.

type PopoverPos = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

function usePopoverPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  fixedWidth: number,
  matchAnchorWidth = false,
  gap = 8
): PopoverPos | null {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = matchAnchorWidth ? r.width : fixedWidth;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const openUp = r.bottom > window.innerHeight * 0.62;
      if (openUp) {
        setPos({
          left,
          width,
          bottom: window.innerHeight - r.top + gap,
          maxHeight: r.top - gap - 8,
        });
      } else {
        setPos({
          left,
          width,
          top: r.bottom + gap,
          maxHeight: window.innerHeight - r.bottom - gap - 8,
        });
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, fixedWidth, matchAnchorWidth, gap]);

  return pos;
}

export function SidebarSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/6 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {title}
        <span className={cn("text-muted-foreground/40 transition-transform duration-200", open && "rotate-90")}>
          ›
        </span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[0.625rem] text-muted-foreground/70">{label}</label>
        <span className="text-[0.625rem] font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer accent-primary"
      />
    </div>
  );
}

const COLOR_PANEL_WIDTH = 256;

/** Modern color picker with presets + hex input. Optionally allows "none". */
export function ModernColorPicker({
  label,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const nativeRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(wrapRef, open, COLOR_PANEL_WIDTH);

  useEffect(() => { setHex(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function commitHex(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-f]{6}$/i.test(v)) { onChange(v); setHex(v); }
  }

  const isNone = allowNone && !value;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "size-9 shrink-0 rounded-lg border-2 border-border shadow-sm transition-transform hover:scale-110",
            isNone && "bg-[repeating-conic-gradient(#64748b_0deg_90deg,transparent_90deg_180deg)] bg-[length:12px_12px]"
          )}
          style={isNone ? undefined : { backgroundColor: value }}
          title={label}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[0.625rem] text-muted-foreground/70 mb-1">{label}</p>
          <Input
            value={isNone ? "" : hex}
            placeholder={isNone ? "Sem cor" : undefined}
            onChange={(e) => setHex(e.target.value)}
            onBlur={(e) => commitHex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitHex(hex)}
            className="h-7 font-mono text-xs uppercase"
            maxLength={7}
          />
        </div>
      </div>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            width: pos.width,
            maxHeight: pos.maxHeight,
            overflowY: "auto",
            zIndex: 10000,
          }}
          className="rounded-xl border border-border bg-card p-3 shadow-2xl dark:border-white/10 dark:bg-surface-elevated"
        >
          <div className="grid grid-cols-9 gap-1 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setHex(c); setOpen(false); }}
                className={cn(
                  "size-6 rounded-md border transition-transform hover:scale-110",
                  value === c ? "border-primary ring-1 ring-primary" : "border-white/10"
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { commitHex(hex); setOpen(false); } }}
              placeholder="#000000"
              className="h-7 flex-1 font-mono text-xs uppercase"
              maxLength={7}
            />
            <button
              onClick={() => nativeRef.current?.click()}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[0.625rem] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Pipette className="size-3" />
              Custom
            </button>
            <input
              ref={nativeRef}
              type="color"
              value={value || "#000000"}
              onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }}
              className="sr-only"
            />
          </div>

          {allowNone && (
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-[0.625rem] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              Remover cor
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Compact font-family dropdown backed by FONT_OPTIONS. */
export function FontPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (family: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-[0.625rem] text-muted-foreground/70">{label}</label>}
      <FontSelect value={value} onChange={onChange} />
    </div>
  );
}

function FontSelect({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(wrapRef, open, 0, true);
  const current = FONT_OPTIONS.find((f) => f.family === value) ?? FONT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-left text-xs hover:border-border/80 transition-colors"
        style={{ fontFamily: current.family }}
      >
        <span className="truncate">{current.label}</span>
        <span className="text-muted-foreground/50 text-[0.6rem]">▾</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            width: pos.width,
            maxHeight: pos.maxHeight,
            zIndex: 10000,
          }}
          className="overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-2xl dark:border-white/10 dark:bg-surface-elevated"
        >
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => { onChange(f.family); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60",
                f.family === value && "bg-primary/10 text-primary"
              )}
              style={{ fontFamily: f.family }}
            >
              {f.label}
              <span className="text-[0.55rem] uppercase tracking-wider text-muted-foreground/40">{f.category}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
