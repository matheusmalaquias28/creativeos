export type MvpBlockType =
  | "title"
  | "subtitle"
  | "paragraph"
  | "bullet"
  | "quote"
  | "cta";

export type MvpBlock = {
  type: MvpBlockType;
  text: string;
};

export type MvpReference = {
  url: string;
  fileName: string;
};

/** compat: nome antigo, mesma shape */
export type MvpPageReference = MvpReference;

export const MVP_MAX_REFERENCES = 5;

/** páginas geradas por lote de spaces_edit (botão "lote N de X") */
export const MVP_BATCH_PAGE_SIZE = 10;

export function mvpTotalBatches(pageCount: number): number {
  return Math.ceil(pageCount / MVP_BATCH_PAGE_SIZE);
}

export function parseMvpReferences(raw: unknown): MvpReference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map((r) => ({
      url: typeof r.url === "string" ? r.url : "",
      fileName: typeof r.fileName === "string" ? r.fileName : "",
    }))
    .filter((r) => r.url.length > 0);
}

export type MvpPage = {
  index: number;
  title: string;
  blocks: MvpBlock[];
  referenceUrls: MvpPageReference[];
};

export type MvpStatus =
  | "organizing"
  | "organized"
  | "organize_failed"
  | "generating"
  | "ready"
  | "failed";

export type MvpProject = {
  id: string;
  title: string;
  docxFileName: string | null;
  pages: MvpPage[];
  logoUrl: string | null;
  status: MvpStatus;
  error: string | null;
  spaceId: string | null;
  spaceUrl: string | null;
  createdAt: string;
};

export function parseMvpPages(raw: unknown): MvpPage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
    .map((p, i) => ({
      index: typeof p.index === "number" ? p.index : i,
      title: typeof p.title === "string" ? p.title : `Página ${i + 1}`,
      blocks: Array.isArray(p.blocks)
        ? (p.blocks as unknown[])
            .filter(
              (b): b is Record<string, unknown> => b !== null && typeof b === "object"
            )
            .map((b) => ({
              type: (typeof b.type === "string" ? b.type : "paragraph") as MvpBlockType,
              text: typeof b.text === "string" ? b.text : "",
            }))
            .filter((b) => b.text.trim().length > 0)
        : [],
      referenceUrls: Array.isArray(p.referenceUrls)
        ? (p.referenceUrls as unknown[])
            .filter(
              (r): r is Record<string, unknown> => r !== null && typeof r === "object"
            )
            .map((r) => ({
              url: typeof r.url === "string" ? r.url : "",
              fileName: typeof r.fileName === "string" ? r.fileName : "",
            }))
            .filter((r) => r.url.length > 0)
        : [],
    }));
}
