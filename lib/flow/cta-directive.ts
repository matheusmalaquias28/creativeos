/**
 * Posição do CTA no node de imagem do Space. Isomórfico, como a logo (ver
 * logo-directive.ts): a UI (node arte) usa os rótulos/opções, e a montagem do
 * prompt usa `buildCtaDirective` para a regra do botão. O CTA fica SEMPRE na
 * parte inferior da arte — o seletor só escolhe esquerda/centro/direita.
 */

export type CtaPosition = "bottom-left" | "bottom-center" | "bottom-right";

export const CTA_POSITIONS: { value: CtaPosition; label: string; phrase: string }[] = [
  { value: "bottom-left", label: "Base esq.", phrase: "alinhado à esquerda" },
  { value: "bottom-center", label: "Base centro", phrase: "centralizado" },
  { value: "bottom-right", label: "Base dir.", phrase: "alinhado à direita" },
];

export const DEFAULT_CTA_POSITION: CtaPosition = "bottom-center";

function positionPhrase(p: string | null | undefined): string {
  return CTA_POSITIONS.find((o) => o.value === p)?.phrase
    ?? CTA_POSITIONS.find((o) => o.value === DEFAULT_CTA_POSITION)!.phrase;
}

/**
 * Regra fixa do CTA nas artes do Space: botão na parte inferior, na posição
 * escolhida, com fundo de cor sólida da identidade visual. Se o prompt do node
 * já disser a cor, ela vence.
 */
export function buildCtaDirective(position: string | null | undefined): string {
  return (
    `O CTA é um BOTÃO: SEMPRE na parte inferior da arte, ${positionPhrase(position)}, ` +
    "com fundo de cor sólida tirada da identidade visual da marca (sem gradiente, sem transparência) " +
    "e o texto do CTA em cor de alto contraste. Se o prompt indicar a cor do CTA, use essa cor."
  );
}
