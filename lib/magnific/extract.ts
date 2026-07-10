// Extração tolerante de campos dos retornos das tools do Magnific.
// O shape exato não é documentado; procuramos chaves recursivamente pra não
// quebrar com mudanças de envelope (ex: {creation:{...}} vs {creations:[{...}]}).
// Algumas tools devolvem texto YAML/TOON-like em vez de JSON — cobrimos via regex.

export function findStrings(value: unknown, key: string, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) findStrings(item, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === key && typeof v === "string" && v.length > 0) out.push(v);
      else findStrings(v, key, out);
    }
  }
  return out;
}

export function firstString(value: unknown, keys: string[]): string | null {
  if (typeof value === "string") {
    for (const key of keys) {
      const match = value.match(new RegExp(`(?:^|\\n)\\s*${key}:\\s*"?([^"\\n]+)"?`));
      if (match) return match[1].trim();
    }
    return null;
  }
  for (const key of keys) {
    const [hit] = findStrings(value, key);
    if (hit) return hit;
  }
  return null;
}
