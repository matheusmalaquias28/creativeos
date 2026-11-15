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
