/** Fuso usado pelo time (e pelo WAR) para interpretar a data de entrega. */
const TIME_ZONE = "America/Sao_Paulo";
/** Offset fixo de Brasília (sem horário de verão desde 2019). */
const TZ_OFFSET = "-03:00";

/** ISO → "YYYY-MM-DD" no fuso de São Paulo (valor do <input type="date">). */
export function dueDateToInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

/**
 * "YYYY-MM-DD" → ISO no fim do dia em São Paulo (23:59). Assim a demanda só
 * fica "Atrasada" depois que o dia de entrega termina, não à meia-noite dele.
 */
export function inputValueToDueDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:00${TZ_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "YYYY-MM-DD" de hoje em São Paulo. */
export function todayInputValue(now: Date = new Date()): string {
  return dueDateToInputValue(now.toISOString());
}

/** Soma dias a um "YYYY-MM-DD" (aritmética em UTC, sem efeito de fuso). */
export function addDays(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de um "YYYY-MM-DD". */
export function weekday(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Grade do mês (semanas começando no domingo) como "YYYY-MM-DD", incluindo os
 * dias do mês anterior/seguinte que completam a primeira e a última semana.
 * `month` é 0-based.
 */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const start = addDays(first, -weekday(first));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Math.ceil((weekday(first) + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}
