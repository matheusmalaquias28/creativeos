/**
 * Leitura/escrita da linha `@(mention) — instrução` dentro do texto de prompt
 * do node arte. Essa é a ÚNICA fonte de verdade para instruções de uso de
 * referência (logo, imagens do acervo): nada que vai pro prompt final pode
 * divergir do que está escrito aqui, visível e editável pelo operador.
 */

/** Label da linha de identidade de marca semeada pelo enrich-graph.ts. */
export const BRAND_IDENTITY_LABEL = "Identidade da marca";

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

/**
 * Cola uma linha `label: conteúdo` no texto do prompt SE ela ainda não
 * existir — pra direcionamento sem uma imagem/node conectável por trás (ex.:
 * identidade de marca do cliente). Diferente de `upsertMentionLine` (que
 * sempre espelha o valor atual de um seletor), aqui não há seletor: semeia
 * uma vez, visível, e dali em diante o texto no canvas manda — editar ou
 * apagar a linha é definitivo, nunca reaparece sozinha sobrescrevendo o que
 * o operador decidiu.
 */
export function seedLabeledLineIfMissing(text: string, label: string, content: string): string {
  const prefix = `${label}:`;
  const already = text.split("\n").some((l) => l.trim().toLowerCase().startsWith(prefix.toLowerCase()));
  if (already) return text;
  const line = `${prefix} ${content}`;
  const base = text.trimEnd();
  return base ? `${base}\n${line}` : line;
}

/**
 * Lê o conteúdo de uma linha `label: conteúdo` do texto do prompt (ver
 * `seedLabeledLineIfMissing`). `parsePromptArteText` só reconhece as 4 labels
 * de copy (Headline/Subheadline/CTA/Extras) — qualquer outra linha, como essa,
 * cai fora do `informacoesExtras` estruturado quando essas labels existem.
 * Por isso a extração do job lê essa linha direto do texto bruto e garante
 * que ela entra no prompt final de qualquer jeito — nunca fica só visível
 * sem efeito.
 */
export function extractLabeledLine(text: string | null | undefined, label: string): string | null {
  if (!text) return null;
  const prefix = `${label}:`;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      return trimmed.slice(prefix.length).trim() || null;
    }
  }
  return null;
}
