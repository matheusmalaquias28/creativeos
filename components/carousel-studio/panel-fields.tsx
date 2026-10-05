"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { normalizeHexColor } from "@/lib/utils/color";

/** Campos compactos dos painéis do editor (densidade de Figma). */

export function PanelSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-white/[0.06] px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2", className)}>{children}</div>;
}

const inputBase =
  "h-7 w-full rounded-md border border-transparent bg-white/[0.06] px-2 text-xs text-white outline-none transition-colors hover:border-white/10 focus:border-indigo-400/70 focus:bg-white/[0.08]";

/**
 * Número com rótulo que vira "scrubber": arraste o rótulo para os lados para
 * ajustar (Shift = passos de 10). Enter/blur confirmam a digitação.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(Math.round(value * 100) / 100));
  }, [value]);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = () => {
    const n = Number(draft.replace(",", "."));
    if (Number.isFinite(n)) onChange(clamp(n));
    else setDraft(String(value));
  };
  const scrub = (e: React.PointerEvent<HTMLSpanElement>) => {
    const startX = e.clientX;
    const start = value;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / 2) * step * (ev.shiftKey ? 10 : 1);
      onChange(clamp(Math.round((start + delta) * 100) / 100));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };
  return (
    <label className="group relative flex items-center">
      <span
        onPointerDown={scrub}
        className="absolute left-2 cursor-ew-resize text-[10px] font-semibold text-white/40 select-none group-hover:text-white/60"
      >
        {label}
      </span>
      <input
        className={cn(inputBase, "pl-7 tabular-nums")}
        value={draft}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(clamp(value + delta));
          }
        }}
      />
      {suffix ? <span className="pointer-events-none absolute right-2 text-[10px] text-white/35">{suffix}</span> : null}
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[11px] text-white/55">
        <span>{label}</span>
        <span className="tabular-nums text-white/40">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-1 w-full cursor-pointer accent-indigo-400"
      />
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(inputBase, "h-auto resize-y py-1.5 leading-relaxed")}
      />
    );
  }
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      className={inputBase}
    />
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  style,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; style?: React.CSSProperties }>;
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(inputBase, "cursor-pointer appearance-none")}
      style={style}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ ...o.style, background: "#1b1b20" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  palette,
  allowNone,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  palette: string[];
  allowNone?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const safe = normalizeHexColor(value ?? "") ?? "#000000";
  return (
    <div className="space-y-1.5">
      {label ? <div className="text-[11px] text-white/55">{label}</div> : null}
      <div className="flex items-center gap-1.5">
        <label
          className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/15"
          style={{
            background: value
              ? safe
              : "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px",
          }}
        >
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          value={draft}
          placeholder={allowNone ? "Nenhuma" : "#000000"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!draft && allowNone) return onChange(null);
            const hex = normalizeHexColor(draft);
            if (hex) onChange(hex);
            else setDraft(value ?? "");
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(inputBase, "font-mono uppercase")}
        />
        {allowNone && value ? (
          <button type="button" onClick={() => onChange(null)} className="shrink-0 text-[10px] text-white/45 hover:text-white">
            Limpar
          </button>
        ) : null}
      </div>
      {palette.length ? (
        <div className="flex flex-wrap gap-1">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(c)}
              className={cn(
                "size-5 rounded border border-white/15 transition-transform hover:scale-110",
                value?.toLowerCase() === c.toLowerCase() && "ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#18181c]"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function IconToggle({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/30"
      )}
    >
      {children}
    </button>
  );
}

export function PanelButton({
  onClick,
  children,
  disabled,
  tone = "default",
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        tone === "primary" && "bg-indigo-500 text-white hover:bg-indigo-400",
        tone === "danger" && "bg-red-500/15 text-red-300 hover:bg-red-500/25",
        tone === "default" && "bg-white/[0.07] text-white/80 hover:bg-white/[0.12] hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}
