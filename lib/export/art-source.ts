import type { DemandArte } from "@/types/demand";
import type { ExportFormat } from "@/lib/export/filename";

export type ExportArtSlot = {
  artIndex: number;
  title: string;
  headline: string;
  subheadline: string;
  cta: string;
  formats: ExportFormat[];
};

/**
 * Fonte das artes para entrega. Rota B usa o quadro da demanda.
 * Rota A (Magnific pull) pode implementar a mesma interface depois.
 */
export interface ArtSourceProvider {
  listArts(demandId: string): Promise<ExportArtSlot[]>;
}

export function slotsFromDemandArtes(artes: DemandArte[]): ExportArtSlot[] {
  return artes.map((arte, index) => ({
    artIndex: index + 1,
    title: arte.headline.trim() || `Arte ${index + 1}`,
    headline: arte.headline,
    subheadline: arte.subheadline,
    cta: arte.cta,
    formats: ["feed", "story"],
  }));
}
