import type { DemandArte } from "@/types/demand";

export type CreativeProfileBrief = {
  basePrompt: string;
  palette: string[];
};

/** Instrução em linguagem natural para `spaces_edit` — não depende de Creative Brain/brand DNA. */
export function buildMagnificSpaceQuery(
  artes: DemandArte[],
  tipo: string | null,
  profile: CreativeProfileBrief | null
): string {
  const parts: string[] = [];

  parts.push(
    tipo
      ? `Crie um conjunto de artes para "${tipo}" usando as imagens de referência já adicionadas neste Space.`
      : "Crie um conjunto de artes usando as imagens de referência já adicionadas neste Space."
  );

  if (profile?.basePrompt.trim()) {
    parts.push(profile.basePrompt.trim());
  }

  if (profile?.palette.length) {
    parts.push(`Utilize as cores: ${profile.palette.slice(0, 6).join(", ")}.`);
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
