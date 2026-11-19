-- Agente de Carrossel: formato "studio" (cards montados a partir das páginas-modelo
-- de um estilo do Carrossel Studio e desenhados no servidor; só as fotos dos campos
-- de imagem passam pela IA). options guarda styleId, studioCards e studioCarouselId.
alter table public.carousel_agent_runs
  drop constraint if exists carousel_agent_runs_format_check;
alter table public.carousel_agent_runs
  add constraint carousel_agent_runs_format_check check (format in ('carousel', 'single', 'tweet', 'studio'));
