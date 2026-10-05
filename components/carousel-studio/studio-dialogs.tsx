"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Gerar de novo ────────────────────────────────────────────────────────────

export function RegenerateDialog({
  open,
  onOpenChange,
  initialBrief,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBrief: string;
  onConfirm: (brief: string) => Promise<void>;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [sending, setSending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar o carrossel de novo</DialogTitle>
          <DialogDescription>
            A IA relê a ficha do cliente, o briefing e as referências e monta tudo do zero. O carrossel atual é
            substituído.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          <label className="text-sm font-medium">Instrução para esta versão (opcional)</label>
          <Textarea
            rows={5}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Ex.: mais clean, fundos claros, use fotos de escritório, títulos maiores, menos imagens…"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={sending}
            onClick={async () => {
              setSending(true);
              try {
                await onConfirm(brief);
                onOpenChange(false);
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Elemento com IA ─────────────────────────────────────────────────────────

export function AiImageDialog({
  open,
  onOpenChange,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string, kind: "background" | "element") => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"background" | "element">("element");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar imagem com IA</DialogTitle>
          <DialogDescription>
            Elementos saem recortados (sem fundo) para compor a página. Cenas viram foto de fundo. Nenhum texto é
            gerado na imagem — textos são sempre camadas editáveis.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={kind === "element" ? "default" : "outline"} onClick={() => setKind("element")}>
              Elemento recortado
            </Button>
            <Button size="sm" variant={kind === "background" ? "default" : "outline"} onClick={() => setKind("background")}>
              Cena / fundo
            </Button>
          </div>
          <Textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              kind === "element"
                ? "Ex.: martelo de juiz dourado em 3D, estilo render suave"
                : "Ex.: escritório de advocacia moderno, luz de fim de tarde, mesa de madeira"
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!prompt.trim()}
            onClick={() => {
              onGenerate(prompt.trim(), kind);
              setPrompt("");
              onOpenChange(false);
            }}
          >
            <Sparkles />
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Referências ─────────────────────────────────────────────────────────────

function Thumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
          title="Remover"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export function ReferencesDialog({
  open,
  onOpenChange,
  carouselId,
  brandReferences,
  demandReferences,
  extraReferences,
  onExtraChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carouselId: string;
  brandReferences: string[];
  demandReferences: string[];
  extraReferences: string[];
  onExtraChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let current = extraReferences;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "reference");
        const res = await fetch(`/api/carousel/studio/${carouselId}/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha no upload");
        current = [...current, data.url];
        onExtraChange(current);
      }
      toast.success("Referência adicionada — vale para a próxima geração");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (url: string) => {
    const next = extraReferences.filter((u) => u !== url);
    onExtraChange(next);
    await fetch(`/api/carousel/studio/${carouselId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference_urls: next }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Referências visuais</DialogTitle>
          <DialogDescription>
            A IA lê todas estas imagens antes de montar o carrossel: as da ficha do cliente, as que vieram na demanda e
            as extras que você subir aqui.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Extras desta demanda</h4>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                Adicionar
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => upload(e.target.files)}
              />
            </div>
            {extraReferences.length ? (
              <div className="grid grid-cols-5 gap-2">
                {extraReferences.map((url) => (
                  <Thumb key={url} url={url} onRemove={() => remove(url)} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma ainda. Suba prints de posts que o cliente gosta, por exemplo.</p>
            )}
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Da demanda ({demandReferences.length})</h4>
            {demandReferences.length ? (
              <div className="grid grid-cols-5 gap-2">
                {demandReferences.map((url) => (
                  <Thumb key={url} url={url} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">A demanda não trouxe imagens de referência.</p>
            )}
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Da ficha do cliente ({brandReferences.length})</h4>
            {brandReferences.length ? (
              <div className="grid grid-cols-5 gap-2">
                {brandReferences.map((url) => (
                  <Thumb key={url} url={url} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                A ficha ainda não tem referências (elas entram na próxima geração depois de carregadas).
              </p>
            )}
          </section>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
