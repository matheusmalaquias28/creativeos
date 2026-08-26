import { slugify } from "@/lib/utils/slug";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLACEHOLDER_NAMES = new Set([
  "ntem",
  "n/a",
  "na",
  "null",
  "undefined",
  "-",
  "--",
  "none",
  "sem cliente",
]);

export function normalizeClientName(name: string): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nomes que não devem virar cadastro de cliente: UUID, hash hex, placeholders.
 * Sem isso, demandas sem cliente cadastrado acabam gerando um "cliente" aleatório
 * e as irmãs da mesma leva ficam órfãs.
 */
export function isGeneratedClientName(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return true;
  if (UUID_RE.test(trimmed)) return true;
  const compact = trimmed.replace(/-/g, "");
  if (/^[0-9a-f]{32,}$/i.test(compact)) return true;
  return false;
}

export function isUsableClientName(name: string): boolean {
  const trimmed = String(name ?? "").trim();
  if (trimmed.length < 2) return false;
  if (isGeneratedClientName(trimmed)) return false;
  return slugify(trimmed).length >= 2;
}

export function displayExternalClientName(name: string): string | null {
  const trimmed = String(name ?? "").trim();
  if (!trimmed || isGeneratedClientName(trimmed)) return null;
  return trimmed;
}
