/**
 * Texto do Studio quebrado em palavras para o Satori (testado).
 *
 * O Satori não faz texto "inline" com estilos misturados: cada palavra vira um
 * bloco num flex com quebra de linha, e cada palavra pode ter partes normais e
 * partes em *destaque* (ex.: "*INSS*?" = "INSS" em destaque + "?").
 */

export type TextPart = { text: string; accent: boolean };
export type TextWord = TextPart[];
/** Parágrafo vazio = linha em branco. */
export type TextParagraph = TextWord[];

export function splitStudioText(text: string, uppercase = false): TextParagraph[] {
  const source = uppercase ? text.toLocaleUpperCase("pt-BR") : text;
  return source.split("\n").map((line) => {
    const words: TextWord[] = [];
    let current: TextWord = [];
    const flush = () => {
      if (current.length) words.push(current);
      current = [];
    };
    // Trechos *em destaque* não atravessam linha (mesma regra do editor).
    for (const segment of line.split(/(\*[^*\n]+\*)/g)) {
      if (!segment) continue;
      const accent = segment.length > 2 && segment.startsWith("*") && segment.endsWith("*");
      const body = accent ? segment.slice(1, -1) : segment;
      for (const piece of body.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) {
          flush();
          continue;
        }
        const last = current[current.length - 1];
        if (last && last.accent === accent) last.text += piece;
        else current.push({ text: piece, accent });
      }
    }
    flush();
    return words;
  });
}
