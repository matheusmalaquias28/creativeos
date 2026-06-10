export type DemandArte = {
  headline: string;
  subheadline: string;
  informacoesExtras: string;
  cta: string;
  linkReferencias: string;
};

export type DemandBriefing = {
  titulo: string;
  instagramCliente: string;
  tipo: string;
  quantidadeArtes: number | null;
  materiaisEditados: string;
  driveMateriais: string;
};

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
  due_date: string | null;
  external_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreativeDemandListItem = CreativeDemand & {
  client_name?: string | null;
};
