import mammoth from "mammoth";

const MAX_CONTENT_CHARS = 80_000;

/**
 * Extrai o texto bruto do .docx preservando quebras de parágrafo. O limite de
 * caracteres protege o prompt do organizador (Claude) de docx gigantes.
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  const text = value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("O .docx não contém texto legível");
  return text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
}
