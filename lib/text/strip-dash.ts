/**
 * Remove travessão (em dash "—" and en dash "–") from generated content.
 * Replaces the dash with a comma so clause-joining reads naturally, then
 * tidies up duplicate commas/spaces and spacing before punctuation.
 */
export function stripTravessao(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}
