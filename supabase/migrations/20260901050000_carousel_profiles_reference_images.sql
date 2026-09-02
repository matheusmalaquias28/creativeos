-- Imagens de referência do perfil, usadas para guiar a geração das imagens de
-- fundo dos carrosséis (Gerador Turbo → Magnific reference_images).
ALTER TABLE carousel_profiles
  ADD COLUMN IF NOT EXISTS reference_images JSONB NOT NULL DEFAULT '[]'::jsonb;
