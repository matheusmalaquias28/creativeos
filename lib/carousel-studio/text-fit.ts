/**
 * Estimativa de quebra de linha sem DOM (roda no servidor ao montar o layout).
 *
 * Não precisa ser exata: serve para escolher um tamanho de fonte que caiba na
 * caixa. No editor a altura real é medida no navegador (`autoHeight`).
 */

/** Largura média de um caractere em "em" por família (aproximação). */
function charWidthEm(fontFamily: string, uppercase: boolean): number {
  const family = fontFamily.toLowerCase();
  let base = 0.54;
  if (family.includes("bebas")) base = 0.4;
  else if (family.includes("oswald")) base = 0.46;
  else if (family.includes("archivo")) base = 0.52;
  else if (family.includes("playfair") || family.includes("lora") || family.includes("merriweather")) base = 0.52;
  else if (family.includes("recoleta")) base = 0.55;
  else if (family.includes("poppins") || family.includes("montserrat")) base = 0.58;
  // Bebas já é toda em caixa alta; para as demais, maiúsculas são mais largas.
  if (uppercase && !family.includes("bebas")) base *= 1.14;
  return base;
}

/** Remove os marcadores de destaque (*trecho*) antes de medir. */
export function stripAccentMarkers(text: string): string {
  return text.replace(/\*/g, "");
}

export function estimateLineCount(params: {
  text: string;
  fontSize: number;
  width: number;
  fontFamily: string;
  uppercase?: boolean;
  letterSpacing?: number;
}): number {
  const { fontSize, width, fontFamily } = params;
  const charWidth = fontSize * charWidthEm(fontFamily, params.uppercase ?? false) + (params.letterSpacing ?? 0);
  const maxChars = Math.max(1, Math.floor(width / charWidth));
  let lines = 0;
  for (const paragraph of stripAccentMarkers(params.text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    lines += 1;
    for (const word of words) {
      const len = word.length;
      if (current === 0) {
        current = len;
        // Palavra maior que a linha quebra em várias.
        if (len > maxChars) {
          lines += Math.floor(len / maxChars);
          current = len % maxChars;
        }
      } else if (current + 1 + len <= maxChars) {
        current += 1 + len;
      } else {
        lines += 1;
        current = len;
      }
    }
  }
  return lines;
}

export function estimateTextHeight(params: {
  text: string;
  fontSize: number;
  width: number;
  fontFamily: string;
  lineHeight: number;
  uppercase?: boolean;
  letterSpacing?: number;
}): number {
  return Math.ceil(estimateLineCount(params) * params.fontSize * params.lineHeight);
}

/**
 * Maior tamanho de fonte (entre min e max) cujo texto cabe na caixa, limitado
 * também a `maxLines`.
 */
export function fitFontSize(params: {
  text: string;
  width: number;
  maxHeight: number;
  fontFamily: string;
  lineHeight: number;
  min: number;
  max: number;
  maxLines?: number;
  uppercase?: boolean;
}): number {
  for (let size = params.max; size > params.min; size -= 2) {
    const lines = estimateLineCount({ ...params, fontSize: size });
    const height = lines * size * params.lineHeight;
    if (height <= params.maxHeight && (!params.maxLines || lines <= params.maxLines)) {
      return size;
    }
  }
  return params.min;
}
