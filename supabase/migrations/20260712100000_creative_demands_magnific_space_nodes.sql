-- Snapshot dos nós do board do Magnific Space, sincronizado via spaces_state
-- ao fim da geração (ver lib/magnific/generate-space.ts)

alter table public.creative_demands
  add column magnific_space_nodes jsonb;
