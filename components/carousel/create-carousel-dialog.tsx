"use client";

import { useActionState, useState } from "react";
import { Layers, Plus, Square, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createCarouselAction } from "@/actions/carousels";
import type { CarouselFormat } from "@/types/carousel";

const FORMATS: {
  value: CarouselFormat;
  label: string;
  ratio: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: string;
}[] = [
  {
    value: "carousel",
    label: "Carrossel",
    ratio: "4:5",
    icon: Layers,
    preview: "aspect-[4/5]",
  },
  {
    value: "square",
    label: "Quadrado",
    ratio: "1:1",
    icon: Square,
    preview: "aspect-square",
  },
  {
    value: "stories",
    label: "Stories",
    ratio: "9:16",
    icon: Monitor,
    preview: "aspect-[9/16]",
  },
];

const initial = { error: undefined, success: undefined };

export function CreateCarouselDialog() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<CarouselFormat>("carousel");
  const [state, formAction, pending] = useActionState(
    createCarouselAction,
    initial
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
        <Plus className="size-4" />
        Novo Carrossel
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl dark:border-white/10 dark:bg-surface-elevated">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Novo Carrossel
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha o formato e dê um nome ao seu carrossel.
              </p>
            </div>

            <form action={formAction} className="px-6 pb-6 space-y-5">
              {/* Hidden format field */}
              <input type="hidden" name="format" value={format} />

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Nome
                </label>
                <Input
                  name="name"
                  placeholder="Ex: Dicas de produtividade"
                  autoFocus
                />
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Formato
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => {
                    const Icon = f.icon;
                    const active = format === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFormat(f.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-premium",
                          active
                            ? "border-primary bg-primary/8 text-foreground"
                            : "border-border hover:border-border/80 hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {/* Mini format preview */}
                        <div
                          className={cn(
                            "w-8 rounded border-2 bg-muted/60",
                            f.preview,
                            active ? "border-primary" : "border-muted-foreground/30"
                          )}
                          style={{ maxHeight: 44 }}
                        />
                        <span className="text-xs font-medium">{f.label}</span>
                        <span className="text-[0.6rem] text-muted-foreground">
                          {f.ratio}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {state?.error && (
                <p className="text-xs text-negative">{state.error}</p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Criando..." : "Criar e editar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
