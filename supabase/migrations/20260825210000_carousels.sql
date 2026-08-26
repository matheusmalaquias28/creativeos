CREATE TABLE IF NOT EXISTS carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Novo Carrossel',
  format TEXT NOT NULL DEFAULT 'carousel' CHECK (format IN ('carousel', 'square', 'stories')),
  post_style TEXT NOT NULL DEFAULT 'minimal' CHECK (post_style IN ('minimal', 'profile', 'creator', 'techviral', 'viralsaas')),
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own carousels"
  ON carousels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX carousels_user_id_updated_at_idx ON carousels (user_id, updated_at DESC);
