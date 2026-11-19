-- Logo do Agente de Carrossel passa a ir no topo à esquerda por padrão (no
-- centro ela caía no rosto das pessoas das fotos). Perfis que estavam no padrão
-- antigo (centralizado) passam para a esquerda.
ALTER TABLE carousel_profiles ALTER COLUMN logo_position SET DEFAULT 'top-left';
UPDATE carousel_profiles SET logo_position = 'top-left' WHERE logo_position = 'top-center';
