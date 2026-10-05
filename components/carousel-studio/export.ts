"use client";

import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import {
  createDemandExportUploadTargetAction,
  recordDemandExportFileAction,
} from "@/actions/demand-export";

/**
 * Exportação PNG das páginas do Studio. As páginas são renderizadas fora da
 * tela pelo mesmo `FrameRenderer` do canvas (tamanho real, sem placeholders)
 * e capturadas com html-to-image.
 */

async function waitForImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : img.decode().catch(
            () =>
              new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
          )
    )
  );
  if (document.fonts?.ready) await document.fonts.ready;
}

export async function renderFrameToBlob(node: HTMLElement, width: number, height: number): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  await waitForImages(node);
  const opts = { width, height, pixelRatio: 1, cacheBust: true };
  // Safari às vezes desenha imagens em branco na 1ª passada; a 2ª sai completa.
  await toBlob(node, opts).catch(() => null);
  const blob = await toBlob(node, opts);
  if (!blob) throw new Error("Falha ao gerar a imagem da página");
  return blob;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Sobe a página como arte `feed-N` da entrega da demanda (mesmo fluxo do "Entregar"). */
export async function uploadPageToDemand(params: {
  demandId: string;
  index: number;
  blob: Blob;
}): Promise<void> {
  const fileName = `carrossel-${params.index}.png`;
  const target = await createDemandExportUploadTargetAction({
    demandId: params.demandId,
    artIndex: params.index,
    format: "feed",
    fileName,
    mimeType: "image/png",
  });
  if (target.error || !target.target) throw new Error(target.error ?? "Falha ao preparar o upload");

  const supabase = createBrowserSupabase();
  const { error } = await supabase.storage
    .from("demand-exports")
    .uploadToSignedUrl(target.target.storagePath, target.target.token, params.blob, { contentType: "image/png" });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  const recorded = await recordDemandExportFileAction({
    demandId: params.demandId,
    artIndex: params.index,
    format: "feed",
    fileName,
    mimeType: "image/png",
    fileSize: params.blob.size,
  });
  if (recorded.error) throw new Error(recorded.error);
}
