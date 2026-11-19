-- Logo aplicada em código nos cards do Agente de Carrossel (lib/carousel-agent/logo.ts).
-- logo_url continua sendo a logo principal (para fundo claro); logo_light_url é a
-- versão clara (para fundo escuro). O código escolhe pela cor do fundo. Sem a
-- versão clara, ela é gerada a partir da principal (logo toda em branco).
ALTER TABLE carousel_profiles
  ADD COLUMN IF NOT EXISTS logo_light_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_light_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS logo_position TEXT NOT NULL DEFAULT 'top-center';

ALTER TABLE carousel_profiles DROP CONSTRAINT IF EXISTS carousel_profiles_logo_position_check;
ALTER TABLE carousel_profiles
  ADD CONSTRAINT carousel_profiles_logo_position_check
  CHECK (logo_position IN ('top-center', 'top-left', 'top-right'));
