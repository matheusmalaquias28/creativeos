-- Versões de cada arte (histórico de ajustes por instrução)

create table public.art_version (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.art_generation_job (id) on delete cascade,
  version_number integer not null default 1,
  result_url text not null,                    -- URL pública do PNG no Supabase Storage
  storage_path text not null,                  -- caminho interno no bucket
  instruction text,                            -- instrução que gerou esta versão (null na v1)
  is_current boolean not null default true,
  created_at timestamptz not null default now(),

  unique (job_id, version_number)
);

create index art_version_job_id_idx on public.art_version (job_id);
create index art_version_job_current_idx on public.art_version (job_id, is_current) where is_current = true;

alter table public.art_version enable row level security;

create policy "Authenticated users can view art versions"
  on public.art_version for select
  to authenticated using (true);

create policy "Authenticated users can insert art versions"
  on public.art_version for insert
  to authenticated with check (true);

create policy "Authenticated users can update art versions"
  on public.art_version for update
  to authenticated using (true);

-- Habilita Realtime para notificação do frontend
alter publication supabase_realtime add table public.art_version;
