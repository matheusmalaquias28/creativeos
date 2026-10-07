import { toast } from "sonner";
import { slugify } from "@/lib/utils/slug";

/**
 * Baixa de verdade (não abre aba nova): a URL do Storage é de outra origem,
 * então `<a download>` sozinho é ignorado pelo navegador — baixa como blob
 * same-origin e aciona o download a partir dele.
 */
export async function downloadImageUrl(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download falhou");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error("Não foi possível baixar a imagem");
  }
}

/** Nome de arquivo a partir de um rótulo, com a extensão da URL (png por padrão). */
export function imageFilename(label: string, url: string): string {
  const ext = url.split("?")[0].match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase() ?? "png";
  return `${slugify(label) || "imagem"}.${ext}`;
}
