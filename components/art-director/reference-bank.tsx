"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REFERENCE_KINDS, type ReferenceKind } from "@/lib/ai/art-director/types";
import type { ReferenceAssetRow } from "@/services/reference-assets";
import { cn } from "@/lib/utils";

const KIND_HINT: Record<ReferenceKind, string> = {
  estilo: "luz, paleta e acabamento — o caso geral",
  layout: "divisão do quadro e hierarquia",
  tipografia: "tratamento de texto, peso e caixa",
  personagem: "tipo físico de uma pessoa",
  produto: "um objeto isolado",
  textura: "superfície, material ou padrão",
};

type Props = {
  clientId: string;
  assets: ReferenceAssetRow[];
};

/**
 * Acervo de referências do cliente. Cada upload é anotado por IA na hora — é a
 * descrição gerada aqui que o diretor de arte lê para escolher referências, não
 * a imagem. Por isso vale conferir a descrição depois de subir.
 */
export function ReferenceBank({ clientId, assets }: Props) {
  const [kind, setKind] = useState<ReferenceKind>("estilo");
  const [uploading, setUploading] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    const list = Array.from(files);
    setUploading(list.length);

    let ok = 0;
    // Sequencial: cada upload dispara uma chamada de visão, e paralelizar só
    // troca espera por rate limit.
    for (const file of list) {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);

      try {
        const res = await fetch(`/api/clients/${clientId}/reference-assets`, {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as { error?: string; annotationError?: string };

        if (!res.ok) {
          toast.error(`${file.name}: ${data.error ?? "falha no upload"}`);
        } else {
          ok += 1;
          if (data.annotationError) {
            toast.warning(`${file.name}: subiu, mas a anotação falhou`);
          }
        }
      } catch {
        toast.error(`${file.name}: falha no upload`);
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (ok > 0) {
      toast.success(`${ok} referência(s) no acervo`);
      router.refresh();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove(assetId: string) {
    setRemoving(assetId);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/reference-assets?assetId=${encodeURIComponent(assetId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Erro ao remover do acervo");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Erro ao remover do acervo");
    } finally {
      setRemoving(null);
    }
  }

  const byKind = REFERENCE_KINDS.map((k) => ({
    kind: k,
    count: assets.filter((a) => a.kind === k).length,
  })).filter((x) => x.count > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-xs text-muted-foreground">Papel</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ReferenceKind)}
            className={cn(
              "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground",
              "outline-none transition-premium focus-visible:ring-2 focus-visible:ring-ring/40",
              "dark:border-white/8 dark:bg-white/5"
            )}
          >
            {REFERENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading > 0}
          className="gap-2"
        >
          {uploading > 0 ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading > 0 ? `Anotando ${uploading}…` : "Subir referências"}
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />

        <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
      </div>

      {byKind.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {byKind.map(({ kind: k, count }) => (
            <Badge key={k} variant="outline">
              {k} · {count}
            </Badge>
          ))}
        </div>
      )}

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Acervo vazio. São necessárias 4 referências (pelo menos 1 de estilo) para
          gerar prompts com IA para este cliente.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <figure
              key={asset.id}
              className="group/asset space-y-2 rounded-2xl border border-border p-3 dark:border-white/8"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl">
                <Image
                  src={asset.storage_url}
                  alt={asset.ai_description ?? asset.file_name ?? "referência"}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => void handleRemove(asset.id)}
                  disabled={removing === asset.id}
                  aria-label="Remover do acervo"
                  className="transition-premium absolute right-2 top-2 rounded-lg bg-background/85 p-1.5 opacity-0 backdrop-blur group-hover/asset:opacity-100 disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <figcaption className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{asset.kind}</Badge>
                  {asset.is_winner && <Badge variant="positive">arte aprovada</Badge>}
                  {asset.annotation_status === "failed" && (
                    <Badge variant="destructive">sem anotação</Badge>
                  )}
                </div>

                <p className="text-xs leading-snug text-foreground/90">
                  {asset.ai_description ?? "Sem descrição — o diretor de arte vai ignorar esta referência."}
                </p>

                {asset.ai_tags.length > 0 && (
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {asset.ai_tags.join(" · ")}
                  </p>
                )}

                <p className="font-mono text-[0.625rem] text-muted-foreground">
                  {asset.usage_count === 0 ? "nunca usada" : `usada ${asset.usage_count}x`}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
