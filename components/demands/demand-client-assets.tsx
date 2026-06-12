"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { buildClientLogoCopyFileName } from "@/lib/utils/logo-filename";
import {
  copyPngBlobToClipboard,
  fetchImagesAsPngBlobs,
} from "@/lib/utils/copy-image";
import { cn } from "@/lib/utils";
import type { ClientReference } from "@/types";

type DemandClientAssetsProps = {
  clientId: string;
  clientName: string;
  logoUrl: string | null;
  references: ClientReference[];
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function DemandClientAssets({
  clientId,
  clientName,
  logoUrl,
  references,
}: DemandClientAssetsProps) {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const pendingBlobsRef = useRef<Blob[] | null>(null);
  const [queueProgress, setQueueProgress] = useState<{
    nextIndex: number;
    total: number;
  } | null>(null);

  const copyItems = useMemo(() => {
    const slug = slugify(clientName) || "cliente";
    const items: { url: string; filename: string }[] = [];

    if (logoUrl) {
      items.push({
        url: logoUrl,
        filename: buildClientLogoCopyFileName(clientName),
      });
    }

    references.forEach((ref, index) => {
      const baseName = ref.file_name.replace(/\.[^.]+$/, "") || `referencia-${index + 1}`;
      items.push({
        url: ref.public_url,
        filename: `${slug}-${baseName}.png`,
      });
    });

    return items;
  }, [clientName, logoUrl, references]);

  useEffect(() => {
    pendingBlobsRef.current = null;
    setQueueProgress(null);
    setCopied(false);
  }, [copyItems]);

  function resetQueue() {
    pendingBlobsRef.current = null;
    setQueueProgress(null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyAll() {
    if (isCopying) return;

    if (pendingBlobsRef.current && queueProgress) {
      const { nextIndex, total } = queueProgress;
      const blobs = pendingBlobsRef.current;

      if (nextIndex >= total) {
        resetQueue();
        return;
      }

      setIsCopying(true);
      try {
        await copyPngBlobToClipboard(blobs[nextIndex]);
        const copiedCount = nextIndex + 1;

        if (copiedCount >= total) {
          toast.success(`Imagem ${copiedCount}/${total} copiada — todas enviadas!`);
          resetQueue();
        } else {
          setQueueProgress({ nextIndex: copiedCount, total });
          toast.success(
            `Imagem ${copiedCount}/${total} copiada — cole no Spaces e clique novamente`
          );
        }
      } catch {
        toast.error("Não foi possível copiar a imagem");
      } finally {
        setIsCopying(false);
      }
      return;
    }

    if (copyItems.length === 0) return;

    setIsCopying(true);
    try {
      const blobs = await fetchImagesAsPngBlobs(copyItems.map((item) => item.url));
      await copyPngBlobToClipboard(blobs[0]);

      if (blobs.length === 1) {
        toast.success("Imagem copiada — cole no Spaces com Ctrl+V");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }

      pendingBlobsRef.current = blobs;
      setQueueProgress({ nextIndex: 1, total: blobs.length });
      toast.success(
        `Imagem 1/${blobs.length} copiada — cole no Spaces e clique em Copiar próxima`
      );
    } catch {
      toast.error("Não foi possível copiar os materiais");
    } finally {
      setIsCopying(false);
    }
  }

  const buttonLabel = queueProgress
    ? `Copiar próxima (${queueProgress.nextIndex + 1}/${queueProgress.total})`
    : "Copiar tudo";

  if (!logoUrl && references.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Nenhuma logo ou referência cadastrada para{" "}
          <span className="font-medium text-foreground">{clientName}</span>.
        </p>
        <Link
          href={`/clients/${clientId}/references`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Cadastrar materiais do cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Materiais de{" "}
          <Link
            href={`/clients/${clientId}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {clientName}
          </Link>
          {queueProgress ? (
            <span className="mt-1 block text-xs">
              Cole cada imagem no Spaces antes de copiar a próxima
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={isCopying}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            {isCopying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {buttonLabel}
          </button>
          <Link
            href={`/clients/${clientId}/references`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
          >
            Ver na página do cliente
          </Link>
        </div>
      </div>

      {logoUrl && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Logo
          </p>
          <div className="inline-flex overflow-hidden rounded-lg border border-border/50 bg-card/30 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`Logo ${clientName}`}
              className="h-20 w-auto object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}

      {references.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Referências ({references.length})
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {references.map((ref) => (
              <div
                key={ref.id}
                className="aspect-square overflow-hidden rounded-lg border border-border/50 bg-card/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ref.public_url}
                  alt={ref.file_name}
                  className="size-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DemandClientAssetsEmpty() {
  return (
    <p className="text-sm text-muted-foreground">
      Vincule um cliente cadastrado para exibir logo e referências visuais.
    </p>
  );
}
