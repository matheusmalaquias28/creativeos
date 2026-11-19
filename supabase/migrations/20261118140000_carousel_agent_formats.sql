-- Agente: além do carrossel em imagem, arte única e carrossel estilo tweet.
--   carousel: cards 100% em imagem (GPT Image)
--   single:   uma arte de feed (GPT Image), post simples no Instagram
--   tweet:    cards "print de tweet" desenhados no servidor (texto exato)
-- options: ajustes por formato (ex.: { "theme": "light" | "dark" } no tweet).

alter table public.carousel_agent_runs
  add column if not exists format text not null default 'carousel',
  add column if not exists options jsonb not null default '{}'::jsonb;

alter table public.carousel_agent_runs
  drop constraint if exists carousel_agent_runs_format_check;
alter table public.carousel_agent_runs
  add constraint carousel_agent_runs_format_check check (format in ('carousel', 'single', 'tweet'));
