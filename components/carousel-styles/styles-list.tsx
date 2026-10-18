"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GalleryHorizontalEnd, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CarouselStyle } from "@/services/carousel-styles";
import { StyleStatusBadge } from "./style-status-badge";

export function StylesList({ initialStyles }: { initialStyles: CarouselStyle[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    try {
      const res = await fetch("/api/carousel/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Falha ao criar o estilo");
      router.push(`/carousel/estilos/${body.style.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar o estilo");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-muted-foreground">{initialStyles.length} estilo(s)</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Novo estilo
        </Button>
      </div>

      {initialStyles.length === 0 ? (
        <EmptyState
          icon={GalleryHorizontalEnd}
          tone="lime"
          title="Nenhum estilo ainda"
          description="Crie um estilo, suba as artes de um carrossel de exemplo e a IA aprende a identidade para aplicar nos próximos."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Criar o primeiro estilo
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {initialStyles.map((style) => (
            <Link
              key={style.id}
              href={`/carousel/estilos/${style.id}`}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--surface-shadow),var(--inner-highlight)] transition-premium hover:border-border-strong"
            >
              <div className="flex h-40 gap-1 overflow-hidden bg-surface p-1">
                {style.images.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Sem artes</div>
                ) : (
                  style.images.slice(0, 5).map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={image.id}
                      src={image.storage_url}
                      alt=""
                      className="h-full min-w-0 flex-1 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ))
                )}
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tracking-tight">{style.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {style.images.length} arte(s){style.dna ? ` · ${style.dna.summary}` : ""}
                  </p>
                </div>
                <StyleStatusBadge status={style.analysis_status} hasImages={style.images.length > 0} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo estilo de carrossel</DialogTitle>
            <DialogDescription>
              Dê um nome e, na próxima tela, suba as artes de um carrossel que representa o estilo.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Carrossel Creato"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) void create();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notas para a IA (opcional)</label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: editorial, muito respiro, números grandes em cada card, fotos P&B"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button disabled={!name.trim() || saving} onClick={() => void create()}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
