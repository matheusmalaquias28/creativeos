import type { DemandArte, DemandBriefing } from "@/types/demand";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null ? String(value) : "";
}

/** Primeiro valor que vira uma string não-vazia após trim; senão "". */
function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const str = asString(value);
    if (str) return str;
  }
  return "";
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normaliza uma lista de URLs vinda do webhook. Aceita tanto um array
 * (`imagensReferencias`) quanto a versão em texto com uma URL por linha
 * (`imagensReferenciasTexto`), sempre devolvendo URLs únicas e não-vazias.
 */
function asUrlList(...values: unknown[]): string[] {
  const urls: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const url = asString(item);
        if (url) urls.push(url);
      }
    } else if (typeof value === "string") {
      for (const line of value.split(/[\n,]+/)) {
        const url = line.trim();
        if (url) urls.push(url);
      }
    }
  }
  return Array.from(new Set(urls));
}

function parsePortugueseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const months: Record<string, number> = {
    janeiro: 0,
    fevereiro: 1,
    marco: 2,
    março: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  };

  const match = trimmed.match(
    /^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})(?:\s+[àa]s\s+(\d{1,2}):(\d{2}))?/i
  );

  if (match) {
    const day = Number(match[1]);
    const monthKey = match[2]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const month = months[monthKey];
    const year = Number(match[3]);
    const hour = match[4] ? Number(match[4]) : 0;
    const minute = match[5] ? Number(match[5]) : 0;

    if (month != null) {
      const date = new Date(year, month, day, hour, minute);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

function parseArteItem(item: unknown): DemandArte | null {
  const record = asRecord(item);
  const headline = asString(record.headline);
  const subheadline = asString(record.subheadline);
  const informacoesExtras = asString(record.informacoesExtras);
  const cta = asString(record.cta);
  const linkReferencias = asString(record.linkReferencias);
  const imagensReferencias = asUrlList(
    record.imagensReferencias,
    record.imagensReferenciasTexto
  );

  if (
    !headline &&
    !subheadline &&
    !informacoesExtras &&
    !cta &&
    !linkReferencias &&
    imagensReferencias.length === 0
  ) {
    return null;
  }

  return {
    headline,
    subheadline,
    informacoesExtras,
    cta,
    linkReferencias,
    imagensReferencias,
  };
}

function parseArtesArray(payload: UnknownRecord): DemandArte[] {
  const direct = payload.artesArray ?? payload.artes;
  if (Array.isArray(direct)) {
    return direct.map(parseArteItem).filter((arte): arte is DemandArte => arte != null);
  }

  const briefing = asRecord(payload.briefing);
  const fromBriefing = briefing.artesArray ?? briefing.artes;
  if (Array.isArray(fromBriefing)) {
    return fromBriefing
      .map(parseArteItem)
      .filter((arte): arte is DemandArte => arte != null);
  }

  const numbered: DemandArte[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (/^\d+$/.test(key)) {
      const arte = parseArteItem(value);
      if (arte) numbered.push(arte);
    }
  }

  return numbered;
}

function parseBriefing(payload: UnknownRecord): DemandBriefing {
  const briefing = asRecord(payload.briefing);
  const cliente = asRecord(payload.cliente);

  // A pasta do Drive pode chegar em `briefing.driveMateriais`, no topo
  // (`driveMateriais`) ou, como último recurso, no `cliente.drive` (a pasta
  // geral do cliente). Pega o primeiro não-vazio.
  const driveMateriais = firstNonEmpty(
    briefing.driveMateriais,
    payload["briefing.driveMateriais"],
    payload.driveMateriais,
    cliente.drive
  );

  return {
    titulo: asString(briefing.titulo ?? payload["briefing.titulo"] ?? payload.titulo),
    instagramCliente: asString(
      briefing.instagramCliente ??
        payload["briefing.instagramCliente"] ??
        payload.instagramCliente
    ),
    tipo: asString(briefing.tipo ?? payload["briefing.tipo"]),
    quantidadeArtes: asNumberOrNull(
      briefing.quantidadeArtes ??
        payload["briefing.quantidadeArtes"] ??
        payload.quantidadeArtes
    ),
    materiaisEditados: asString(
      briefing.materiaisEditados ??
        payload["briefing.materiaisEditados"] ??
        payload.materiaisEditados
    ),
    driveMateriais,
  };
}

export type ParsedMakeDemand = {
  externalId: string;
  /** ID fixo do cliente no WAR — âncora estável para vincular a demanda (não muda entre demandas). */
  externalClientId: string;
  clientName: string;
  tipo: string;
  squad: string;
  gestor: string;
  webdesigner: string;
  solicitante: string;
  briefing: DemandBriefing;
  artes: DemandArte[];
  status: string;
  dueDate: string | null;
  externalCreatedAt: string | null;
  /** Todas as URLs de imagens de referência da demanda (nível topo + por arte), deduplicadas. */
  referenceImageUrls: string[];
};

/**
 * Reúne todas as imagens de referência do payload — a lista achatada de topo
 * (`imagensReferencias`/`imagensReferenciasTexto`) somada às referências de cada
 * arte já parseada — para ingestão em `demand_reference_image`.
 */
function collectReferenceImageUrls(
  payload: UnknownRecord,
  artes: DemandArte[]
): string[] {
  return asUrlList(
    payload.imagensReferencias,
    payload.imagensReferenciasTexto,
    ...artes.map((arte) => arte.imagensReferencias)
  );
}

/**
 * Extrai o ID fixo do cliente no WAR de um `raw_payload` já armazenado (aceita
 * tanto `clientId` no topo quanto `cliente.id`). Usado ao vincular manualmente
 * uma demanda a um cliente existente: a demanda carrega o ID certo do WAR, então
 * gravamos esse ID no cliente para que as próximas demandas casem direto por ID.
 */
export function externalClientIdFromPayload(payload: unknown): string | null {
  const record = asRecord(payload);
  const cliente = asRecord(record.cliente);
  const value = asString(record.clientId ?? cliente.id);
  return value || null;
}

export function parseMakeDemandPayload(payload: unknown): ParsedMakeDemand | null {
  const record = asRecord(payload);
  const externalId = asString(record.id);
  const clientName = asString(record.clientName);
  const cliente = asRecord(record.cliente);
  const externalClientId = asString(record.clientId ?? cliente.id);

  if (!externalId || !clientName) return null;

  const createdAtRaw = asString(record.createdAt);
  const dueDateRaw = asString(record.dueDate);
  const artes = parseArtesArray(record);

  return {
    externalId,
    externalClientId,
    clientName,
    tipo: asString(record.tipo),
    squad: asString(record.squad),
    gestor: asString(record.gestor),
    webdesigner: asString(record.webdesigner),
    solicitante: asString(record.solicitante),
    briefing: parseBriefing(record),
    artes,
    status: asString(record.status),
    dueDate: dueDateRaw ? parsePortugueseDate(dueDateRaw) ?? dueDateRaw : null,
    externalCreatedAt: createdAtRaw
      ? parsePortugueseDate(createdAtRaw) ?? createdAtRaw
      : null,
    referenceImageUrls: collectReferenceImageUrls(record, artes),
  };
}
