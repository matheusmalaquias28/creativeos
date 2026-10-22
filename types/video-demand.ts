/**
 * Demandas de vídeo — recebidas via webhook do WAR (payload com `tipo: "video"`).
 *
 * Compartilham o vocabulário de status das demandas de arte (ver `types/demand`),
 * então o round-trip de status com o WAR (webhook de entrada + callback de saída)
 * continua idêntico. O que muda é o briefing: vídeo tem quantidade de vídeos,
 * prioridade, pastas de Drive e uma descrição livre — sem o conceito de "artes".
 */

export {
  DEMAND_STATUSES as VIDEO_DEMAND_STATUSES,
  DEMAND_INITIAL_STATUS as VIDEO_DEMAND_INITIAL_STATUS,
  DEMAND_QUEUE_STATUS as VIDEO_DEMAND_QUEUE_STATUS,
  DEMAND_WORKING_STATUS as VIDEO_DEMAND_WORKING_STATUS,
  DEMAND_DONE_STATUS as VIDEO_DEMAND_DONE_STATUS,
  isClosedStatus,
  isDoneStatus,
  type DemandStatus as VideoDemandStatus,
} from "./demand";

export type VideoBriefing = {
  titulo: string;
  instagramCliente: string;
  prioridade: string;
  /** Quantidade de vídeos pedidos na demanda. */
  quantidadeVideos: number | null;
  /** Pasta do Drive com os materiais brutos. */
  driveMateriais: string;
  /** Pasta do Drive onde entram os vídeos editados (entrega). */
  driveEditados: string;
  /** Descrição livre do briefing (o texto corrido do pedido). */
  descricao: string;
};

export type VideoDemand = {
  id: string;
  external_id: string;
  client_id: string | null;
  client_name_external: string;
  client_not_found: boolean;
  tipo: string | null;
  categoria: string | null;
  prioridade: string | null;
  squad: string | null;
  gestor: string | null;
  webdesigner: string | null;
  solicitante: string | null;
  briefing: VideoBriefing;
  status: string | null;
  is_archived: boolean;
  is_new: boolean;
  started_at: string | null;
  completed_at: string | null;
  elapsed_seconds: number | null;
  due_date: string | null;
  external_created_at: string | null;
  drive_folder_url: string | null;
  drive_folder_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoDemandListItem = VideoDemand & {
  client_name?: string | null;
  client_slug?: string | null;
  /** Status aceitos pelo WAR para esta demanda (extraídos do raw_payload). */
  status_permitidos?: string[];
};

/** Item + payload cru do WAR, usado na página de detalhe para exibir tudo. */
export type VideoDemandDetail = VideoDemandListItem & {
  raw_payload: unknown;
};
