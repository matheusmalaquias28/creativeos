import type { MagnificSpaceNode } from "@/types/demand";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extrai o catálogo de nós do retorno do `spaces_state` (texto TOON, não JSON).
 * O bloco relevante tem o formato:
 *
 *   nodes[6]{id,type,name,selected,x,y,...}:
 *     0b0266f8-...,image-generator,"Arte 1 — Atenção",false,100,...
 *
 * O header lista as colunas — resolvemos os índices por nome pra não quebrar se
 * o Magnific reordenar/acrescentar colunas. Linhas que não começam com UUID são
 * ignoradas (fim do bloco ou ruído).
 */
export function parseSpaceStateNodes(state: unknown): MagnificSpaceNode[] {
  const text = typeof state === "string" ? state : JSON.stringify(state);
  const lines = text.split("\n");

  const headerIndex = lines.findIndex((line) => /^nodes\[\d+\]\{[^}]*\}:/.test(line.trim()));
  if (headerIndex === -1) return [];

  const columns = (lines[headerIndex].match(/\{([^}]*)\}/)?.[1] ?? "")
    .split(",")
    .map((c) => c.trim());
  const idCol = columns.indexOf("id");
  const typeCol = columns.indexOf("type");
  const nameCol = columns.indexOf("name");
  if (idCol === -1 || typeCol === -1) return [];

  const nodes: MagnificSpaceNode[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const cells = splitToonRow(line);
    if (!cells[idCol] || !UUID_RE.test(cells[idCol])) break; // fim do bloco
    nodes.push({
      id: cells[idCol],
      type: cells[typeCol] ?? "",
      name: nameCol === -1 ? "" : (cells[nameCol] ?? ""),
    });
  }
  return nodes;
}

/** Split CSV-like respeitando células entre aspas duplas (nomes podem ter vírgula). */
function splitToonRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Parse tolerante do valor jsonb `magnific_space_nodes` vindo do banco. */
export function parseStoredSpaceNodes(value: unknown): MagnificSpaceNode[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.type !== "string") return null;
      return {
        id: record.id,
        type: record.type,
        name: typeof record.name === "string" ? record.name : "",
      };
    })
    .filter((node): node is MagnificSpaceNode => node != null);
}
