export const INSTAGRAM_POST_STATUSES = ["draft", "scheduled", "publishing", "published", "failed", "canceled"] as const;
export type InstagramPostStatus = (typeof INSTAGRAM_POST_STATUSES)[number];

export const INSTAGRAM_POST_STATUS_LABEL: Record<InstagramPostStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
  canceled: "Cancelado",
};

/** Um card do carrossel, já em JPEG no bucket `instagram-posts`. */
export type InstagramPostItem = {
  url: string;
  path: string;
  /** Página do Studio de onde o card saiu (só referência). */
  page_id?: string | null;
  /** Arte da entrega da demanda de onde o card saiu (só referência). */
  export_file_id?: string | null;
};

export type InstagramPost = {
  id: string;
  studio_carousel_id: string | null;
  demand_id: string | null;
  client_id: string | null;
  ig_user_id: string;
  ig_username: string | null;
  items: InstagramPostItem[];
  caption: string;
  scheduled_at: string | null;
  status: InstagramPostStatus;
  media_id: string | null;
  permalink: string | null;
  error: string | null;
  publishing_started_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramAccountInfo = { igUserId: string; username: string | null };
