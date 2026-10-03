/**
 * Posição + tamanho da logo no node de imagem do Space. Isomórfico: a UI (node
 * arte) usa os rótulos/opções, e o worker usa `buildLogoDirective` para montar
 * a instrução que vai no prompt de geração. Mudar o seletor muda a frase.
 */

export type LogoPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type LogoSize = "small" | "medium" | "large";

export const LOGO_POSITIONS: { value: LogoPosition; label: string; phrase: string }[] = [
  { value: "top-left", label: "Topo esq.", phrase: "no canto superior esquerdo" },
  { value: "top-center", label: "Topo centro", phrase: "no topo, centralizada" },
  { value: "top-right", label: "Topo dir.", phrase: "no canto superior direito" },
  { value: "bottom-left", label: "Base esq.", phrase: "no canto inferior esquerdo" },
  { value: "bottom-center", label: "Base centro", phrase: "na base, centralizada" },
  { value: "bottom-right", label: "Base dir.", phrase: "no canto inferior direito" },
];

export const LOGO_SIZES: { value: LogoSize; label: string; phrase: string }[] = [
  { value: "small", label: "Pequena", phrase: "em tamanho pequeno e discreto" },
  { value: "medium", label: "Média", phrase: "em tamanho médio" },
  { value: "large", label: "Grande", phrase: "em tamanho grande, com destaque" },
];

export const DEFAULT_LOGO_POSITION: LogoPosition = "top-left";
export const DEFAULT_LOGO_SIZE: LogoSize = "small";

function positionPhrase(p: string | undefined): string {
  return LOGO_POSITIONS.find((o) => o.value === p)?.phrase
    ?? LOGO_POSITIONS[0].phrase;
}
function sizePhrase(s: string | undefined): string {
  return LOGO_SIZES.find((o) => o.value === s)?.phrase ?? LOGO_SIZES[0].phrase;
}

/** Frase de instrução da logo para o prompt de geração (logo como referência). */
export function buildLogoDirective(
  position: string | undefined,
  size: string | undefined
): string {
  return (
    `Inclua a logo da marca (anexada como referência) ${sizePhrase(size)}, posicionada ${positionPhrase(position)}, ` +
    "reservando uma área limpa ao redor dela. Mantenha a logo fiel — não redesenhe nem distorça — e NÃO coloque texto ou elementos por cima dela."
  );
}
