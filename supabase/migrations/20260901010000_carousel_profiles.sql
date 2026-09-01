-- Pre-configured design profiles for clients used by the carousel studio.
CREATE TABLE IF NOT EXISTS carousel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Novo Perfil',
  logo_url TEXT,
  logo_storage_path TEXT,
  font_title TEXT,
  font_body TEXT,
  color_background TEXT NOT NULL DEFAULT '#0a0a0a',
  color_title TEXT NOT NULL DEFAULT '#ffffff',
  color_subtitle TEXT NOT NULL DEFAULT '#a3a3a3',
  color_accent TEXT NOT NULL DEFAULT '#3b82f6',
  palette JSONB NOT NULL DEFAULT '[]'::jsonb,
  instagram_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE carousel_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own carousel profiles" ON carousel_profiles;
CREATE POLICY "Users can manage their own carousel profiles"
  ON carousel_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS carousel_profiles_user_id_updated_at_idx
  ON carousel_profiles (user_id, updated_at DESC);
