// Trechos de ~12k caracteres mantêm cada resposta do organizador pequena
// (sem risco de truncar o JSON) e viram a unidade de checkpoint do progresso.
const CHUNK_TARGET_CHARS = 12_000;

/**
 * Divide o conteúdo em trechos por parágrafo, sem cortar parágrafo no meio.
 * Determinístico: o mesmo conteúdo sempre gera os mesmos trechos, o que
 * permite retomar a organização a partir do índice salvo em organize_progress.
 */
export function splitContentIntoChunks(raw: string): string[] {
  const paragraphs = raw.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) chunks.push(current);

  return chunks.length > 0 ? chunks : [raw];
}
