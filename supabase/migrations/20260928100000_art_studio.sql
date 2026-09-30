-- Art Studio: geração de criativos num fluxo único, em tempo real.
--
-- Três coisas que faltavam para o estúdio funcionar:
--   1. apagar arte/prompt (não havia policy de DELETE — o delete sumia em silêncio);
--   2. mais de uma versão por arte (o unique era por (job, version_number) e o
--      worker sempre gravava v1 → regenerar estourava a constraint);
--   3. a adaptação 9:16 para stories, que é outra imagem do MESMO job e não pode
--      concorrer com a arte 3:4 pela numeração nem pelo is_current.

-- ---------------------------------------------------------------------------
-- 1. DELETE
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can delete art jobs" on public.art_generation_job;
create policy "Authenticated users can delete art jobs"
  on public.art_generation_job for delete to authenticated using (true);

drop policy if exists "Authenticated users can delete art versions" on public.art_version;
create policy "Authenticated users can delete art versions"
  on public.art_version for delete to authenticated using (true);

-- O payload de DELETE do Realtime só traz as colunas da identidade da réplica.
-- Com `default` vem a PK, que é o suficiente para o estúdio remover o card.

-- ---------------------------------------------------------------------------
-- 2. Formato da versão
-- ---------------------------------------------------------------------------

alter table public.art_version
  add column if not exists format text not null default 'feed';

alter table public.art_version
  drop constraint if exists art_version_format_check;
alter table public.art_version
  add constraint art_version_format_check check (format in ('feed', 'story'));

comment on column public.art_version.format is
  'feed = arte 3:4 gerada pelo diretor de arte; story = adaptação 9:16 da arte aprovada.';

-- A numeração passa a correr por formato: v1 do feed e v1 do story convivem.
alter table public.art_version
  drop constraint if exists art_version_job_id_version_number_key;
alter table public.art_version
  drop constraint if exists art_version_job_format_version_key;
alter table public.art_version
  add constraint art_version_job_format_version_key
    unique (job_id, format, version_number);

drop index if exists public.art_version_job_current_idx;
create index if not exists art_version_job_current_idx
  on public.art_version (job_id, format, is_current)
  where is_current;

-- ---------------------------------------------------------------------------
-- 3. Estado da adaptação para stories, por arte
-- ---------------------------------------------------------------------------
--
-- Coluna própria (e não o `status` do job) porque a arte 3:4 continua pronta
-- enquanto o story é gerado — são dois ciclos de vida no mesmo registro.

alter table public.art_generation_job
  add column if not exists story_status text not null default 'idle',
  add column if not exists story_error text;

alter table public.art_generation_job
  drop constraint if exists art_generation_job_story_status_check;
alter table public.art_generation_job
  add constraint art_generation_job_story_status_check
    check (story_status in ('idle', 'queued', 'processing', 'succeeded', 'failed'));

create index if not exists art_generation_job_story_status_idx
  on public.art_generation_job (demand_id)
  where story_status in ('queued', 'processing');
