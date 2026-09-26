export type TweetTheme = "light" | "dark";

export type TweetProfile = {
  id: string;
  user_id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
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
