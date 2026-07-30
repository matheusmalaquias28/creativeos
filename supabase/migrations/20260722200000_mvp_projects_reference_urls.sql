-- Referências visuais gerais do MVP (até 5) — conectadas em todos os nodes
-- de geração de imagem, em vez de referências por página.

alter table public.mvp_projects
  add column reference_urls jsonb not null default '[]'::jsonb;
