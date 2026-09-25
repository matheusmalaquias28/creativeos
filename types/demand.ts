import type { MagnificSpaceStatus } from "./database";
import type { DemandExportStatus } from "./demand-export";

/** Nó do board do Magnific Space, sincronizado via spaces_state após a geração. */
export type MagnificSpaceNode = {
  id: string;
  type: string;
  name: string;
};

export type DemandArte = {
  headline: string;
  subheadline: string;
  informacoesExtras: string;
  cta: string;
  linkReferencias: string;
  /** URLs de imagens de referência específicas desta arte (enviadas no webhook). */
  imagensReferencias: string[];
};

export type DemandBriefing = {
  titulo: string;
  instagramCliente: string;
  tipo: string;
  quantidadeArtes: number | null;
  materiaisEditados: string;
  driveMateriais: string;
};

/**
 * Vocabulário de status compartilhado com o WAR (a plataforma que origina as
 * demandas). O CreativeOS adota exatamente esses valores para que o webhook de
 * entrada e o callback de saída façam o round-trip sem perda. O WAR ainda pode
 * mandar status "custom" (ex.: "Falta material do cliente") — esses são tratados
 * como válidos em runtime, apenas não aparecem na lista fixa abaixo.
 */
export const DEMAND_STATUSES = [
  "Aguardando Definição de Data",
  "Em Fila",
  "Fazendo",
  "Aprovação de Copy",
  "Aprovação do Gestor",
  "Ajuste",
  "Aprovação do Cliente",
  "Aprovado",
  "Atrasado",
  "Concluído",
] as const;

export type DemandStatus = (typeof DEMAND_STATUSES)[number];

/** Status inicial padrão quando o WAR não envia um status na criação. */
export const DEMAND_INITIAL_STATUS: DemandStatus = "Aguardando Definição de Data";
/** Próximo status na fila, após a data de entrega ser definida. */
export const DEMAND_QUEUE_STATUS: DemandStatus = "Em Fila";
/** Status que inicia o cronômetro de execução. */
export const DEMAND_WORKING_STATUS: DemandStatus = "Fazendo";
/** Status terminal — conclui, arquiva e para o cronômetro. */
export const DEMAND_DONE_STATUS: DemandStatus = "Concluído";

/**
 * Status considerados "fechados" para fins de cor/agrupamento e analytics.
 * Inclui os valores legados ("Concluída"/"Cancelada") de demandas criadas antes
 * da adoção do vocabulário do WAR.
 */
export const CLOSED_DEMAND_STATUSES = new Set<string>([
  "Concluído",
  "Concluída", // legado
  "Cancelada", // legado
]);

/** True para o status terminal de conclusão (novo "Concluído" ou legado "Concluída"). */
export function isDoneStatus(status: string | null | undefined): boolean {
  return status === "Concluído" || status === "Concluída";
}

/** True quando a demanda está fechada (concluída ou cancelada). */
export function isClosedStatus(status: string | null | undefined): boolean {
  return status != null && CLOSED_DEMAND_STATUSES.has(status);
}

export type CreativeDemand = {
  id: string;
  external_id: string;
  client_id: string | null;
  client_name_external: string;
  client_not_found: boolean;
  tipo: string | null;
  squad: string | null;
  gestor: string | null;
  webdesigner: string | null;
  solicitante: string | null;
  briefing: DemandBriefing;
  artes: DemandArte[];
  status: string | null;
  is_archived: boolean;
  is_new: boolean;
  started_at: string | null;
  completed_at: string | null;
  elapsed_seconds: number | null;
  due_date: string | null;
  external_created_at: string | null;
  magnific_space_id: string | null;
  magnific_space_url: string | null;
  magnific_space_status: MagnificSpaceStatus;
  magnific_space_error: string | null;
  magnific_space_nodes: MagnificSpaceNode[];
  drive_folder_url?: string | null;
  drive_folder_id?: string | null;
  export_status?: DemandExportStatus | null;
  export_error?: string | null;
  exported_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreativeDemandListItem = CreativeDemand & {
  client_name?: string | null;
  client_slug?: string | null;
  /** Contagem leve para listagens (artes completas só no detalhe). */
  artes_count?: number;
  /** Status aceitos pelo WAR para esta demanda (extraídos do raw_payload). */
  status_permitidos?: string[];
  /**
   * `client_art_readiness.is_ready` do cliente vinculado — null quando não há
   * cliente vinculado ainda. Usado pro badge "materiais pendentes" no Kanban.
   */
  client_materials_ready?: boolean | null;
};

export type DemandMonthStat = {
  month: string;
  label: string;
  total_demands: number;
  total_artes: number;
  avg_elapsed_minutes: number | null;
};

/** Comparativo de um período contra o anterior. `pct` é null quando não há base (anterior = 0). */
export type DashboardDelta = {
  current: number;
  previous: number;
  pct: number | null;
};

export type DemandStatusCount = {
  status: string;
  count: number;
};

export type DashboardAnalytics = {
  /** Série mensal recortada para a janela de atividade (sem meses vazios à esquerda). */
  months: DemandMonthStat[];
  demandsMonth: DashboardDelta;
  artesMonth: DashboardDelta;
  demandsWeek: DashboardDelta;
  artesWeek: DashboardDelta;
  statusCounts: DemandStatusCount[];
  activeDemands: number;
  completedThisMonth: number;
  avgTurnaroundMinutes: number | null;
  totalDemands: number;
  totalArtes: number;
  savedMinutesMonth: number;
};
