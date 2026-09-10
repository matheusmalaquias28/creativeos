import { slugify } from "@/lib/utils/slug";

export type ExportFormat = "feed" | "story";

function extensionFromNameOrType(fileName: string, mimeType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName === "jpg" || fromName === "jpeg" || fromName === "png" || fromName === "webp") {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

/**
 * Título da demanda + cliente + formato + índice.
 * Ex.: criativos-doctor-clean-feed-1.png
 */
export function buildExportFilename(params: {
  demandTitle: string;
  clientName: string;
  clientSlug?: string | null;
  format: ExportFormat;
  index: number;
  fileName?: string;
  mimeType?: string;
}): string {
  const titleSlug = slugify(params.demandTitle || "") || "criativos";
  const clientSlug = slugify(params.clientSlug || params.clientName || "") || "cliente";
  const base = titleSlug.includes(clientSlug)
    ? titleSlug
    : `${titleSlug}-${clientSlug}`;
  const ext = extensionFromNameOrType(params.fileName ?? "", params.mimeType ?? "");
  return `${base}-${params.format}-${params.index}.${ext}`;
}

export function demandExportTitle(params: {
  briefingTitle?: string | null;
  tipo?: string | null;
}): string {
  const title = params.briefingTitle?.trim();
  if (title) return title;
  const tipo = params.tipo?.trim();
  if (tipo && !/^(arte|artes|criativo|criativos)$/i.test(tipo)) return tipo;
  return "Criativos";
}
