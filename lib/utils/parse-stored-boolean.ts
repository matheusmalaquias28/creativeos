export function parseStoredBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return null;
}

export function isNegativeOpportunity(value: unknown): boolean {
  return parseStoredBoolean(value) === false;
}
