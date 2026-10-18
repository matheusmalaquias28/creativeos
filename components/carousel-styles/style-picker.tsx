"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CarouselStyleOption } from "@/services/carousel-styles";

/**
 * Escolha do estilo do acervo para a geração do Carrossel Studio, com o
 * preview grande de todos os cards do estilo escolhido. Estilos sem DNA
 * aparecem desabilitados: sem análise, a IA não tem o que seguir.
 */
export function StylePicker({
  styles,
  value,
  onChange,
  disabled,
  previewClassName,
}: {
  styles: CarouselStyleOption[];
  value: string | null;
  onChange: (styleId: string | null) => void;
  disabled?: boolean;
  /** Altura dos cards do preview (padrão: até 22rem). */
  previewClassName?: string;
}) {
  const current = styles.find((s) => s.id === value);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium">Estilo do carrossel</label>
          <Link href="/carousel/estilos" target="_blank" className="text-xs text-muted-foreground hover:text-foreground">
            Gerenciar estilos
          </Link>
        </div>
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-10 w-full rounded-xl border border-border bg-input px-3.5 text-sm text-foreground outline-none transition-premium hover:border-border-strong focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-50 [&>option]:bg-popover [&>option]:text-popover-foreground"
        >
          <option value="">Sem estilo (só a ficha do cliente)</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id} disabled={s.analysis_status !== "ready" && s.id !== value}>
              {s.name} · {s.imageCount} arte(s){s.analysis_status !== "ready" ? " (sem DNA)" : ""}
            </option>
          ))}
        </select>
      </div>

      {current && current.imageUrls.length > 0 ? (
        <div className="space-y-2">
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {current.imageUrls.map((url, index) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                title={`Abrir o card ${index + 1} em tamanho real`}
                className="relative shrink-0 snap-start overflow-hidden rounded-xl ring-1 ring-border transition-premium hover:ring-2 hover:ring-tone-lime"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${current.name}, card ${index + 1}`}
                  className={cn("block h-[min(22rem,48vh)] w-auto bg-surface object-contain", previewClassName)}
                />
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-white">
                  {index + 1}/{current.imageUrls.length}
                </span>
              </a>
            ))}
          </div>
          {current.summary ? <p className="text-xs leading-relaxed text-muted-foreground">{current.summary}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
