/**
 * Locale directive appended to every carousel image-generation prompt so any
 * text baked into the image is Brazilian Portuguese and scenes lean Brazilian.
 */
export const IMAGE_PROMPT_PT_BR_SUFFIX =
  "Importante: se a imagem contiver qualquer texto, ele deve estar em português do Brasil (nunca em inglês). Prefira cenários, ambientes e pessoas brasileiras quando fizer sentido.";

export function withPtBrImagePrompt(prompt: string): string {
  const p = (prompt ?? "").trim();
  if (!p) return p;
  return `${p}. ${IMAGE_PROMPT_PT_BR_SUFFIX}`;
}
