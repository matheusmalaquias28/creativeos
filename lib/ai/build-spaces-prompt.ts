import type { BrandDna } from "@/types";

export type SpacesPromptInput = {
  headline?: string;
  subheadline?: string;
  cta?: string;
  extraContext?: string;
};

export function buildSpacesPrompt(
  brandDna: BrandDna,
  copy: SpacesPromptInput
): string {
  const parts: string[] = [];

  parts.push("Desenvolva uma arte premium para anúncios.");

  const colors = brandDna.preferredColors.slice(0, 5).join(", ");
  if (colors) parts.push(`Utilize as cores: ${colors}.`);

  parts.push(`Estilo da marca: ${brandDna.brandStyle}.`);
  parts.push(`Direção visual: ${brandDna.visualDirection}.`);

  if (brandDna.visualKeywords?.length) {
    parts.push(
      `Referências de estilo: ${brandDna.visualKeywords.slice(0, 5).join(", ")}.`
    );
  }

  if (brandDna.compositionPreferences?.length) {
    parts.push(
      `Composição: ${brandDna.compositionPreferences.slice(0, 3).join(", ")}.`
    );
  }

  parts.push(
    "Use as referências como exemplo visual — não copie a copy nem as cores."
  );

  if (brandDna.negativeStyles?.length) {
    parts.push(`Evitar: ${brandDna.negativeStyles.slice(0, 4).join(", ")}.`);
  }

  const hasCopy = copy.headline || copy.subheadline || copy.cta;
  if (hasCopy) {
    const copyParts: string[] = [];
    if (copy.headline) copyParts.push(`Headline: ${copy.headline}`);
    if (copy.subheadline) copyParts.push(`Subheadline: ${copy.subheadline}`);
    if (copy.cta) copyParts.push(`CTA: ${copy.cta}`);
    parts.push(`Utilize a copy — ${copyParts.join("  ")}.`);
  }

  if (copy.extraContext?.trim()) {
    parts.push(copy.extraContext.trim());
  }

  return parts.join(" ");
}
