"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * Dropdown compacto e estilizado para os controles dos nodes — substitui o
 * `<select>` nativo (feio e inconsistente entre navegadores). Abre um painel
 * flutuante; `nodrag/nowheel/nopan` evitam que o canvas capture os gestos.
 */
export function NodeSelect({
  value,
  options,
  onChange,
  title,
  className,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "nodrag flex w-full items-center justify-between gap-1 rounded-lg border bg-input px-1.5 py-1 font-mono text-[0.625rem] font-medium text-foreground transition-premium",
          open ? "border-primary/60 ring-2 ring-ring/20" : "border-border hover:border-border-strong"
        )}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="nodrag nowheel nopan absolute bottom-full left-0 z-50 mb-1 max-h-44 w-full min-w-max overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-[var(--surface-shadow-elevated)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-[0.625rem] transition-colors",
                opt.value === value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && <Check className="size-3 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
