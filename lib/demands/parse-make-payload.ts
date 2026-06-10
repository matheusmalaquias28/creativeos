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

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  if (!headline && !subheadline) return null;

  return {
    headline,
    subheadline,
    informacoesExtras: asString(record.informacoesExtras),
    cta: asString(record.cta),
    linkReferencias: asString(record.linkReferencias),
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

  return {
    titulo: asString(briefing.titulo ?? payload["briefing.titulo"]),
    instagramCliente: asString(
      briefing.instagramCliente ?? payload["briefing.instagramCliente"]
    ),
    tipo: asString(briefing.tipo ?? payload["briefing.tipo"]),
    quantidadeArtes: asNumberOrNull(
      briefing.quantidadeArtes ?? payload["briefing.quantidadeArtes"]
    ),
    materiaisEditados: asString(
      briefing.materiaisEditados ?? payload["briefing.materiaisEditados"]
    ),
    driveMateriais: asString(
      briefing.driveMateriais ?? payload["briefing.driveMateriais"]
    ),
  };
}

export type ParsedMakeDemand = {
  externalId: string;
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
};

export function parseMakeDemandPayload(payload: unknown): ParsedMakeDemand | null {
  const record = asRecord(payload);
  const externalId = asString(record.id);
  const clientName = asString(record.clientName);

  if (!externalId || !clientName) return null;

  const createdAtRaw = asString(record.createdAt);
  const dueDateRaw = asString(record.dueDate);

  return {
    externalId,
    clientName,
    tipo: asString(record.tipo),
    squad: asString(record.squad),
    gestor: asString(record.gestor),
    webdesigner: asString(record.webdesigner),
    solicitante: asString(record.solicitante),
    briefing: parseBriefing(record),
    artes: parseArtesArray(record),
    status: asString(record.status),
    dueDate: dueDateRaw ? parsePortugueseDate(dueDateRaw) ?? dueDateRaw : null,
    externalCreatedAt: createdAtRaw
      ? parsePortugueseDate(createdAtRaw) ?? createdAtRaw
      : null,
  };
}
