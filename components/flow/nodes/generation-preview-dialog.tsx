"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ScanEye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PreviewReference = {
  url: string;
  intent: string;
  kind: "logo" | "ref" | "item";
  label: string;
};

type Preview = {
  prompt: string;
  references: PreviewReference[];
  droppedReferences: number;
  batch: (string | null)[];
  aspectRatio: string;
  imageSize: string;
  quality: string;
};

/**
 * "O que vai na geração": busca no servidor a montagem EXATA que o worker usa
 * para este node (prompt, referências na ordem enviada, lote) e exibe tudo.
 * `prepare` salva o fluxo antes — o preview lê o fluxo salvo, como a geração.
 */
export function GenerationPreviewDialog({
  demandId,
  artIndex,
  prepare,
  onClose,
}: {
  demandId: string;
  artIndex: number;
  prepare: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await prepare())) throw new Error("Não foi possível salvar o fluxo");
        const res = await fetch(`/api/demands/${demandId}/flow/preview-node?artIndex=${artIndex}`);
        const body = (await res.json()) as Preview & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Erro ao montar o preview");
        if (!cancelled) setPreview(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandId, artIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fanout = preview?.batch.some((u) => u !== null) ?? false;
  const generations = preview?.batch.length ?? 0;

  return createPortal(
    <div className="nodrag nopan nowheel fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[var(--surface-shadow-elevated),var(--inner-highlight)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <ScanEye className="size-4 text-muted-foreground" />
          <h2 className="flex-1 truncate text-sm font-semibold text-foreground">
            O que vai na geração
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} title="Fechar">
            <X />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {error ? (
            <p className="text-sm text-tone-red">{error}</p>
          ) : !preview ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">Lote</h3>
                <p className="text-sm text-foreground">
                  {fanout
                    ? `${generations} ${generations === 1 ? "geração" : "gerações"} — 1 por item da lista (cada item entra como Imagem 1)`
                    : `${generations} ${generations === 1 ? "variação" : "variações"} do mesmo prompt`}
                  {" · "}
                  {preview.aspectRatio} · {preview.imageSize} · esforço {preview.quality}
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Imagens enviadas ({preview.references.length})
                </h3>
                {preview.references.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma — geração só pelo texto.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {preview.references.map((ref, i) => (
                      <li key={`${ref.url}-${i}`} className="flex items-start gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.url}
                          alt=""
                          className={cn(
                            "size-11 shrink-0 rounded-lg border border-border bg-surface",
                            ref.kind === "logo" ? "object-contain p-1" : "object-cover"
                          )}
                        />
                        <div className="min-w-0 text-xs">
                          <p className="font-semibold text-foreground">
                            Imagem {i + 1} · {ref.label}
                            {fanout && ref.kind === "item" ? " (muda a cada geração)" : ""}
                          </p>
                          <p className="text-muted-foreground">{ref.intent}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {preview.droppedReferences > 0 && (
                  <p className="text-xs text-tone-red">
                    {preview.droppedReferences} imagem(ns) além do limite do modelo não{" "}
                    {preview.droppedReferences === 1 ? "será enviada" : "serão enviadas"}.
                  </p>
                )}
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">Prompt enviado</h3>
                <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 font-sans text-xs leading-relaxed text-foreground">
                  {preview.prompt}
                </pre>
                <p className="text-[0.6875rem] text-muted-foreground">
                  Se a revisão automática reprovar a arte, uma 2ª tentativa recebe também as
                  correções apontadas.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
