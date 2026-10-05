/**
 * Leitura/escrita da linha `@(mention) — instrução` dentro do texto de prompt
 * do node arte. Essa é a ÚNICA fonte de verdade para instruções de uso de
 * referência (logo, imagens do acervo): nada que vai pro prompt final pode
 * divergir do que está escrito aqui, visível e editável pelo operador.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extrai a instrução associada a uma menção `@(mentionKey)` numa linha no
 * formato `@(mentionKey) — instrução`. `mentionKey` já deve vir normalizado
 * (minúsculo, espaços trocados por `-`). Retorna `null` se a menção não
 * aparecer seguida de instrução — chamado deve decidir o fallback.
 */
export function extractMentionInstruction(
  text: string | null | undefined,
  mentionKey: string
): string | null {
  if (!text) return null;
  const token = escapeRegExp(`@(${mentionKey})`);
  const re = new RegExp(`${token}\\s*[—:-]\\s*(.+)`, "i");
  for (const line of text.split("\n")) {
    const m = line.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

/**
 * Insere ou atualiza a linha `@(mentionKey) — instruction` no texto do
 * prompt. Se a menção já existir numa linha, substitui a linha inteira
 * (evita duplicar ao trocar o seletor várias vezes).
 */
export function upsertMentionLine(
  text: string,
  mentionKey: string,
  instruction: string
): string {
  const token = `@(${mentionKey})`;
  const line = `${token} — ${instruction}`;
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trim().toLowerCase().startsWith(token.toLowerCase()));
  if (idx !== -1) {
    lines[idx] = line;
    return lines.join("\n");
  }
  const base = text.trimEnd();
  return base ? `${base}\n${line}` : line;
}
