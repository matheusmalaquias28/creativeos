"use client";

import { ViewportPortal } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { DemandFrame } from "@/lib/flow/organize";

/**
 * Molduras das demandas no Space compartilhado do cliente: uma caixa com o
 * título atrás de cada fluxo (coordenadas do fluxo, sob nodes e conexões).
 * Só visual — não é node, não persiste e não captura clique.
 */
export function DemandFrames({ frames, currentDemandId }: { frames: DemandFrame[]; currentDemandId: string }) {
  if (frames.length < 2) return null;
  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0 -z-10">
        {frames.map((f) => {
          const current = f.demandId === currentDemandId;
          return (
            <div
              key={f.demandId}
              className={cn(
                "absolute rounded-[2rem] border-2 border-dashed",
                current ? "border-primary/50 bg-primary/[0.04]" : "border-border-strong/60 bg-muted/20"
              )}
              style={{ transform: `translate(${f.x}px, ${f.y}px)`, width: f.w, height: f.h }}
            >
              <div className="flex items-center gap-2 px-7 pt-5">
                <span className={cn("text-xl font-semibold", current ? "text-foreground" : "text-muted-foreground")}>
                  {f.title?.trim() || "Demanda sem título"}
                </span>
                {current && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                    Esta demanda
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ViewportPortal>
  );
}
