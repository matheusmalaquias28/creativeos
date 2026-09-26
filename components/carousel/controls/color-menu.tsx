"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePopoverPosition } from "@/components/carousel/controls/popover-position";
import { clamp, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type HSV, type RGB } from "@/lib/design/color";

/** Acima de qualquer modal, sidebar ou overlay da aplicação. */
export const TOP_LAYER_Z = 2147483000;

// ─── Seletor RGB ─────────────────────────────────────────────────────────────

/**
 * Seletor completo: área saturação/brilho, faixa de matiz, campos R/G/B e hex.
 * Os controles de arrastar não tiram o foco do texto em edição.
 */
export function RgbColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(hexToRgb(value) ?? { r: 0, g: 0, b: 0 }));
  const [hexDraft, setHexDraft] = useState(value);
  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);

  // Sincroniza quando o valor muda por fora (sem perder a matiz em cinzas).
  useEffect(() => {
    if (value.toLowerCase() === rgbToHex(hsvToRgb(hsv)).toLowerCase()) return;
    const parsed = hexToRgb(value);
    if (parsed) setHsv(rgbToHsv(parsed));
    setHexDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(next: HSV) {
    setHsv(next);
    const h = rgbToHex(hsvToRgb(next));
    setHexDraft(h);
    onChange(h);
  }

  function drag(el: HTMLElement | null, e: React.PointerEvent, apply: (x: number, y: number) => void) {
    if (!el) return;
    e.preventDefault();
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect();
      apply(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
    };
    move(e);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function setChannel(ch: keyof RGB, raw: string) {
    const n = clamp(Number(raw) || 0, 0, 255);
    commit(rgbToHsv({ ...rgb, [ch]: n }));
  }

  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  return (
    <div className="space-y-2.5">
      <div
        ref={areaRef}
        onPointerDown={(e) => drag(areaRef.current, e, (x, y) => commit({ ...hsv, s: x, v: 1 - y }))}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg"
        style={{
          backgroundColor: hueColor,
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <span
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={(e) => drag(hueRef.current, e, (x) => commit({ ...hsv, h: Math.min(x * 360, 359.9) }))}
        className="relative h-3 w-full cursor-pointer touch-none rounded-full"
        style={{
          background:
            "linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)",
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
        />
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_1.6fr] gap-1.5">
        {(["r", "g", "b"] as const).map((ch) => (
          <label key={ch} className="space-y-0.5">
            <span className="block text-center text-[0.625rem] font-bold uppercase text-muted-foreground">{ch}</span>
            <input
              type="number"
              min={0}
              max={255}
              inputMode="numeric"
              value={Math.round(rgb[ch])}
              onChange={(e) => setChannel(ch, e.target.value)}
              className="h-7 w-full rounded-md border border-border bg-input px-1 text-center text-xs tabular-nums text-foreground outline-none [appearance:textfield] focus:border-primary/60 [&::-webkit-inner-spin-button]:appearance-none"
            />
          </label>
        ))}
        <label className="space-y-0.5">
          <span className="block text-center text-[0.625rem] font-bold uppercase text-muted-foreground">Hex</span>
          <input
            value={hexDraft}
            maxLength={7}
            onChange={(e) => {
              setHexDraft(e.target.value);
              const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
              const parsed = hexToRgb(v);
              if (parsed) commit(rgbToHsv(parsed));
            }}
            className="h-7 w-full rounded-md border border-border bg-input px-1 text-center font-mono text-xs uppercase text-foreground outline-none focus:border-primary/60"
          />
        </label>
      </div>
    </div>
  );
}

// ─── Botão de cor para barras de ferramentas de texto ────────────────────────

const PANEL_WIDTH = 248;

/**
 * Botão + painel de cor (presets + seletor RGB). O painel vai para um portal
 * fixo no topo de tudo, então nunca é cortado por sidebars ou modais.
 * Presets aplicam na hora; a cor personalizada aplica no botão "Aplicar".
 */
export function ColorMenuButton({
  icon,
  title,
  presets,
  onPick,
  onClear,
  clearLabel = "Remover",
  buttonClassName,
}: {
  icon: React.ReactNode;
  title: string;
  presets: string[];
  onPick: (color: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("#1d9bf0");
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(anchorRef, open, PANEL_WIDTH);

  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
          buttonClassName
        )}
      >
        {icon}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title}
            onMouseDown={(e) => {
              // Mantém a seleção do texto; inputs continuam focáveis.
              if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              zIndex: TOP_LAYER_Z,
            }}
            className="space-y-3 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-[var(--surface-shadow-elevated)]"
          >
            <div className="grid grid-cols-8 gap-1.5">
              {presets.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className="aspect-square w-full rounded-md border border-border-strong transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="border-t border-border pt-3">
              <RgbColorPicker value={custom} onChange={setCustom} />
              <button
                type="button"
                onClick={() => {
                  onPick(custom);
                  setOpen(false);
                }}
                className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <span className="size-3.5 rounded-sm border border-white/60" style={{ backgroundColor: custom }} />
                <Check className="size-3.5" />
                Aplicar cor
              </button>
            </div>

            {onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[0.6875rem] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {clearLabel}
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
