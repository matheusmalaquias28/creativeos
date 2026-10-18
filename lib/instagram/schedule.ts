/**
 * Agendamento: o operador escolhe data e hora no fuso de São Paulo,
 * independente do fuso do navegador ou do servidor.
 */

export const INSTAGRAM_TIMEZONE = "America/Sao_Paulo";
/** Agendar com folga mínima: o cron roda a cada poucos minutos. */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60_000;
export const MAX_SCHEDULE_AHEAD_MS = 75 * 24 * 60 * 60_000;

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado. */
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "2026-10-20T18:30" (horário de parede no fuso) → instante UTC em ISO.
 * Duas passadas cobrem a troca de horário de verão, se o fuso voltar a ter.
 */
export function zonedLocalToUtcIso(local: string, timeZone = INSTAGRAM_TIMEZONE): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error("Data e hora inválidas");
  const [, y, mo, d, h, mi, s] = m;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  let guess = wall - offsetMs(wall, timeZone);
  guess = wall - offsetMs(guess, timeZone);
  return new Date(guess).toISOString();
}

/** Instante → "2026-10-20T18:30" no fuso (valor de <input type="datetime-local">). */
export function utcToZonedLocal(iso: string | number | Date, timeZone = INSTAGRAM_TIMEZONE): string {
  const instant = new Date(iso).getTime();
  const local = new Date(instant + offsetMs(instant, timeZone));
  return local.toISOString().slice(0, 16);
}

export function formatInstagramDate(iso: string, timeZone = INSTAGRAM_TIMEZONE): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Devolve a mensagem de erro, ou null se o horário serve. */
export function validateScheduledAt(iso: string, now = Date.now()): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "Data e hora inválidas";
  if (at < now + MIN_SCHEDULE_LEAD_MS) return "Agende para pelo menos 5 minutos a partir de agora";
  if (at > now + MAX_SCHEDULE_AHEAD_MS) return "Agende para no máximo 75 dias a partir de hoje";
  return null;
}
