import type { BrandDna } from "@/types";
import type { DemandArte } from "@/types/demand";

/** Instrução em linguagem natural para `spaces_edit` — adaptado de lib/ai/build-spaces-prompt.ts. */
export function buildMagnificSpaceQuery(
  brandDna: BrandDna,
  artes: DemandArte[],
  tipo: string | null
): string {
  const parts: string[] = [];

  parts.push(
    tipo
      ? `Crie um conjunto de artes premium para "${tipo}" usando as imagens de referência já adicionadas neste Space.`
      : "Crie um conjunto de artes premium usando as imagens de referência já adicionadas neste Space."
  );

  const colors = brandDna.preferredColors.slice(0, 5).join(", ");
  if (colors) parts.push(`Utilize as cores: ${colors}.`);

  parts.push(`Estilo da marca: ${brandDna.brandStyle}.`);
  parts.push(`Direção visual: ${brandDna.visualDirection}.`);

  if (brandDna.visualKeywords?.length) {
    parts.push(`Referências de estilo: ${brandDna.visualKeywords.slice(0, 5).join(", ")}.`);
  }
  if (brandDna.compositionPreferences?.length) {
    parts.push(`Composição: ${brandDna.compositionPreferences.slice(0, 3).join(", ")}.`);
  }
  if (brandDna.negativeStyles?.length) {
    parts.push(`Evitar: ${brandDna.negativeStyles.slice(0, 4).join(", ")}.`);
  }

  artes.forEach((arte, index) => {
    const copyParts: string[] = [];
    if (arte.headline) copyParts.push(`Headline: ${arte.headline}`);
    if (arte.subheadline) copyParts.push(`Subheadline: ${arte.subheadline}`);
    if (arte.cta) copyParts.push(`CTA: ${arte.cta}`);
    if (copyParts.length === 0) return;

    const label = artes.length > 1 ? `Arte ${index + 1}` : "Arte";
    parts.push(`${label} — ${copyParts.join("  ")}.`);
    if (arte.informacoesExtras.trim()) parts.push(arte.informacoesExtras.trim());
  });

  return parts.join(" ");
}
