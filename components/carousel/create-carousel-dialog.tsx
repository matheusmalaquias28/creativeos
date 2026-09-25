"use client";

import { useActionState, useState } from "react";
import { Layers, Plus, Square, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus />
        Novo carrossel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo carrossel</DialogTitle>
            <DialogDescription>
              Escolha o formato e dê um nome ao seu carrossel.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="flex min-h-0 flex-1 flex-col">
            {/* Hidden format field */}
            <input type="hidden" name="format" value={format} />

            <DialogBody className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="carousel-name"
                  className="text-[0.8125rem] font-semibold text-foreground"
                >
                  Nome
                </label>
                <Input
                  id="carousel-name"
                  name="name"
                  placeholder="Ex: Dicas de produtividade"
                  autoFocus
                />
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <p className="text-[0.8125rem] font-semibold text-foreground">Formato</p>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => {
                    const active = format === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFormat(f.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-premium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active
                            ? "border-primary/60 bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:bg-accent"
                        )}
                      >
                        {/* Mini format preview */}
                        <div
                          className={cn(
                            "w-8 rounded border-2",
                            f.preview,
                            active
                              ? "border-primary bg-primary/15"
                              : "border-border-strong bg-muted"
                          )}
                          style={{ maxHeight: 44 }}
                        />
                        <span className="text-xs font-semibold">{f.label}</span>
                        <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                          {f.ratio}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {state?.error && (
                <p className="rounded-lg border border-tone-red/25 bg-tone-red/12 px-3 py-2 text-xs text-tone-red">
                  {state.error}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
