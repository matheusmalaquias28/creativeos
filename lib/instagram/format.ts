/** Regras de formato que valem no navegador e no servidor (sem sharp). */

/** Studio: 4:5 e 1:1 entram no feed; 9:16 é formato de Stories. */
export function feedFormatError(format: string): string | null {
  return format === "9:16"
    ? "Carrossel em 9:16 não pode ir para o feed: o Instagram só aceita de 4:5 a 1.91:1. Mude o formato do Studio para 4:5 ou 1:1."
    : null;
}
