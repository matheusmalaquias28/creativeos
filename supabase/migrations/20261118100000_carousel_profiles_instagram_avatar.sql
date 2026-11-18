-- Logo do perfil do Instagram (opcional), separada da logo normal da marca.
-- Usada como foto do perfil nos carrosséis tweet; sem ela, cai na logo normal.
ALTER TABLE carousel_profiles
  ADD COLUMN IF NOT EXISTS instagram_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_avatar_storage_path TEXT;
