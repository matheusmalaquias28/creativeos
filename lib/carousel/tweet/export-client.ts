"use client";

import { TWEET_CANVAS } from "@/types/tweet-carousel";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Celular/tablet: salvar via share sheet (no iPhone → "Salvar imagem" vai para Fotos). */
export function prefersShareSheet(): boolean {
  if (typeof window === "undefined") return false;
  return isIOS() || window.matchMedia("(pointer: coarse)").matches;
}

/** Renderiza o canvas 1080×1350 em PNG. */
export async function renderCardFile(node: HTMLElement, fileName: string): Promise<File> {
  const { toBlob } = await import("html-to-image");
  const opts = {
    width: TWEET_CANVAS.width,
    height: TWEET_CANVAS.height,
    pixelRatio: 1,
    cacheBust: true,
  };
  // Safari às vezes desenha imagens em branco na 1ª passada; a 2ª já sai completa.
  if (isIOS()) await toBlob(node, opts).catch(() => null);
  const blob = await toBlob(node, opts);
  if (!blob) throw new Error("Falha ao gerar a imagem");
  return new File([blob], fileName, { type: "image/png" });
}

export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  );
}

/**
 * Entrega os arquivos: share sheet no celular, download no desktop.
 * Retorna "needs-gesture" quando o navegador exige um novo toque para abrir o
 * share sheet (a ativação do clique expira durante a renderização).
 */
export async function deliverFiles(files: File[]): Promise<"ok" | "cancelled" | "needs-gesture"> {
  if (prefersShareSheet() && canShareFiles(files)) {
    try {
      await navigator.share({ files });
      return "ok";
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "AbortError") return "cancelled";
      if (name === "NotAllowedError") return "needs-gesture";
      // Sem suporte real a arquivos: cai para o download.
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (files.length > 1) await new Promise((r) => setTimeout(r, 350));
  }
  return "ok";
}

/** Share direto (chamado de dentro de um clique, com os arquivos já prontos). */
export async function shareFilesNow(files: File[]): Promise<boolean> {
  try {
    await navigator.share({ files });
    return true;
  } catch {
    return false;
  }
}
