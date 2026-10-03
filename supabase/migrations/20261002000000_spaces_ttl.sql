-- Space (canvas próprio): bucket de imagens + TTL de 15 dias das imagens geradas
-- pelo fluxo efêmero, mantendo o grafo. Idempotente (aplicar via MCP Supabase).

-- 1) Bucket das artes geradas (hoje criado à mão no dashboard) — fixa em migration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'art-generations',
  'art-generations',
  true,
  52428800, -- 50 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Public read for art-generations" on storage.objects;
create policy "Public read for art-generations"
  on storage.objects for select
  to public
  using (bucket_id = 'art-generations');

-- 2) Marca jobs do fluxo/Space como efêmeros (curadoria permanece false).
alter table public.art_generation_job
  add column if not exists ephemeral boolean not null default false;

-- 3) Expiração das versões geradas (só as efêmeras recebem expires_at).
alter table public.art_version
  add column if not exists expires_at timestamptz;

create index if not exists art_version_expires_at_idx
  on public.art_version (expires_at)
  where expires_at is not null;

-- 4) Agendamento da limpeza (pg_cron + pg_net chamando a rota protegida).
--    A rota /api/spaces/cleanup apaga os PNGs do Storage (SDK) + as linhas
--    expiradas, mantendo o grafo. URL e secret são específicos do deploy —
--    defina-os como settings do banco e descomente o agendamento:
--
--    alter database postgres set app.cleanup_url  = 'https://SEU-APP/api/spaces/cleanup';
--    alter database postgres set app.cleanup_secret = 'o-mesmo-SPACES_CLEANUP_SECRET-do-.env';
--
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se reaplicar a migration).
select cron.unschedule('spaces-ttl-cleanup')
where exists (select 1 from cron.job where jobname = 'spaces-ttl-cleanup');

-- Diariamente às 04:00 UTC: dispara a rota de limpeza. Só funciona depois de
-- definir os settings acima (sem eles, current_setting(..., true) é null e o
-- job não faz nada útil).
select cron.schedule(
  'spaces-ttl-cleanup',
  '0 4 * * *',
  $$
  select net.http_post(
    url := current_setting('app.cleanup_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', current_setting('app.cleanup_secret', true)
    ),
    body := '{}'::jsonb
  )
  where current_setting('app.cleanup_url', true) is not null;
  $$
);
