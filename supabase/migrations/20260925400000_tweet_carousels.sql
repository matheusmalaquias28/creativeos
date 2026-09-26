-- Carrossel estilo tweet: perfis (foto + nome + @) e carrosséis renderizados em código.
CREATE TABLE IF NOT EXISTS tweet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tweet_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tweet profiles" ON tweet_profiles;
CREATE POLICY "Users can manage their own tweet profiles"
  ON tweet_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tweet_profiles_user_id_updated_at_idx
  ON tweet_profiles (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tweet_carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES tweet_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Carrossel tweet',
  -- Snapshot do perfil ({ name, handle, avatarUrl }) para o carrossel não quebrar se o perfil mudar.
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  source_input TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tweet_carousels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tweet carousels" ON tweet_carousels;
CREATE POLICY "Users can manage their own tweet carousels"
  ON tweet_carousels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tweet_carousels_user_id_updated_at_idx
  ON tweet_carousels (user_id, updated_at DESC);
