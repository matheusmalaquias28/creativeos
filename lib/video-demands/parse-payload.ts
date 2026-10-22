import type { VideoBriefing } from "@/types/video-demand";

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
 * O tipo que marca uma demanda como vídeo. O WAR manda `tipo: "video"` (com ou
 * sem acento/caixa) no topo do payload — é o único discriminador entre demanda
 * de arte e de vídeo.
 */
export function isVideoDemandPayload(payload: unknown): boolean {
  const tipo = asString(asRecord(payload).tipo)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (vídeo → video)
    .toLowerCase();
  return tipo === "video" || tipo === "videos" || tipo === "reels";
}

function parseBriefing(payload: UnknownRecord): VideoBriefing {
  const briefing = asRecord(payload.briefing);
  const cliente = asRecord(payload.cliente);

  const driveMateriais = firstNonEmpty(
    briefing.driveMateriais,
    payload["briefing.driveMateriais"],
    payload.driveMateriais,
    cliente.drive
  );

  const driveEditados = firstNonEmpty(
    briefing.driveEditados,
    payload["briefing.driveEditados"],
    payload.driveEditados
  );

  // A descrição corrida do pedido pode chegar como `briefing.briefing`,
  // `briefingDescricao` (topo) ou, por último, o `briefingTexto` montado.
  const descricao = firstNonEmpty(
    briefing.briefing,
    briefing.descricao,
    payload.briefingDescricao,
    payload.briefingTexto
  );

  return {
    titulo: firstNonEmpty(briefing.titulo, payload["briefing.titulo"], payload.titulo),
    instagramCliente: firstNonEmpty(
      briefing.instagramCliente,
      payload["briefing.instagramCliente"],
      payload.instagramCliente,
      cliente.instagram
    ),
    prioridade: firstNonEmpty(briefing.prioridade, payload.prioridade),
    quantidadeVideos: asNumberOrNull(
      briefing.quantidadeVideos ??
        payload["briefing.quantidadeVideos"] ??
        payload.quantidadeVideos
    ),
    driveMateriais,
    driveEditados,
    descricao,
  };
}

function parsePortugueseOrIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export type ParsedVideoDemand = {
  externalId: string;
  /** ID fixo do cliente no WAR — âncora estável para vincular a demanda. */
  externalClientId: string;
  clientName: string;
  tipo: string;
  categoria: string;
  prioridade: string;
  squad: string;
  gestor: string;
  webdesigner: string;
  solicitante: string;
  briefing: VideoBriefing;
  status: string;
  dueDate: string | null;
  externalCreatedAt: string | null;
};

export function parseVideoDemandPayload(payload: unknown): ParsedVideoDemand | null {
  const record = asRecord(payload);
  const externalId = asString(record.id);
  const clientName = asString(record.clientName);
  const cliente = asRecord(record.cliente);
  const externalClientId = asString(record.clientId ?? cliente.id);

  if (!externalId || !clientName) return null;

  const briefing = parseBriefing(record);
  const dueDateRaw = asString(record.dueDate);
  const createdAtRaw = asString(record.createdAt);

  return {
    externalId,
    externalClientId,
    clientName,
    tipo: asString(record.tipo),
    categoria: asString(record.categoria),
    prioridade: briefing.prioridade || asString(record.prioridade),
    squad: asString(record.squad),
    gestor: asString(record.gestor),
    webdesigner: asString(record.webdesigner),
    solicitante: asString(record.solicitante),
    briefing,
    status: asString(record.status),
    dueDate: dueDateRaw ? parsePortugueseOrIsoDate(dueDateRaw) ?? dueDateRaw : null,
    externalCreatedAt: createdAtRaw
      ? parsePortugueseOrIsoDate(createdAtRaw) ?? createdAtRaw
      : null,
  };
}
