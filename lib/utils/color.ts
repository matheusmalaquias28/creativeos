/** Normaliza entrada hex para #RRGGBB */
export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/);
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${hex.toUpperCase()}`;
}

export function isValidHexColor(input: string): boolean {
  return normalizeHexColor(input) !== null;
}
