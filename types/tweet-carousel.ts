export type TweetTheme = "light" | "dark";

export type TweetProfile = {
  id: string;
  user_id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  /**
   * De onde o perfil vem. Ausente = `tweet_profiles`. "design" = perfil do
   * Carrossel Avançado (`carousel_profiles`): usa a logo, o nome e o @ do Instagram.
   */
  source?: "design";
};

/** Snapshot do perfil gravado no carrossel (não quebra se o perfil for editado/excluído). */
export type TweetProfileSnapshot = {
  name: string;
  handle: string;
  avatarUrl: string | null;
};

export type TweetCard = {
  id: string;
  /** HTML sanitizado (negrito, itálico, cores, quebras de linha). */
  html: string;
  imageUrl: string | null;
  /** Tamanho do texto em px no canvas 1080×1350. null = ajuste automático. */
  fontSize: number | null;
};

export type TweetCarousel = {
  id: string;
  user_id: string;
  profile_id: string | null;
  name: string;
  profile: TweetProfileSnapshot;
  theme: TweetTheme;
  cards: TweetCard[];
  source: "ai" | "manual";
  source_input: string | null;
  created_at: string;
  updated_at: string;
};

export const TWEET_CANVAS = { width: 1080, height: 1350 } as const;

export function makeTweetCard(overrides?: Partial<TweetCard>): TweetCard {
  return {
    id: crypto.randomUUID(),
    html: "",
    imageUrl: null,
    fontSize: null,
    ...overrides,
  };
}

export function normalizeHandle(handle: string): string {
  const clean = handle.trim().replace(/^@+/, "").replace(/\s+/g, "");
  return clean ? `@${clean}` : "";
}

/** Perfil de design (Carrossel Avançado) no formato de perfil do carrossel tweet. */
export function designProfileToTweetProfile(p: {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  instagram_avatar_url?: string | null;
  instagram_handle: string | null;
  created_at: string;
  updated_at: string;
}): TweetProfile {
  return {
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    handle: normalizeHandle(p.instagram_handle ?? ""),
    // Logo do perfil do Instagram quando houver; senão, a logo normal.
    avatar_url: p.instagram_avatar_url || p.logo_url,
    created_at: p.created_at,
    updated_at: p.updated_at,
    source: "design",
  };
}
