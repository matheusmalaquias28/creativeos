-- Entrega de artes (Rota B): pasta do Drive + arquivos enviados por slot

alter table public.creative_demands
  add column if not exists drive_folder_url text,
  add column if not exists drive_folder_id text,
  add column if not exists export_status text not null default 'pending'
    check (export_status in ('pending', 'running', 'done', 'error')),
  add column if not exists export_error text,
  add column if not exists exported_at timestamptz;

create index if not exists creative_demands_export_status_idx
  on public.creative_demands (export_status);

update public.creative_demands
set
  drive_folder_url = coalesce(
    nullif(briefing->>'driveMateriais', ''),
    nullif(briefing->>'materiaisEditados', '')
  ),
  drive_folder_id = coalesce(
    (regexp_match(coalesce(briefing->>'driveMateriais', ''), '/folders/([a-zA-Z0-9_-]{10,})'))[1],
    (regexp_match(coalesce(briefing->>'driveMateriais', ''), '[?&]id=([a-zA-Z0-9_-]{10,})'))[1],
    (regexp_match(coalesce(briefing->>'materiaisEditados', ''), '/folders/([a-zA-Z0-9_-]{10,})'))[1],
    (regexp_match(coalesce(briefing->>'materiaisEditados', ''), '[?&]id=([a-zA-Z0-9_-]{10,})'))[1]
  )
where drive_folder_id is null;

create table if not exists public.demand_export_files (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.creative_demands (id) on delete cascade,
  art_index integer not null,
  format text not null check (format in ('feed', 'story')),
  filename text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  file_size bigint,
  drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demand_id, art_index, format)
);

create index if not exists demand_export_files_demand_id_idx
  on public.demand_export_files (demand_id);

drop trigger if exists demand_export_files_updated_at on public.demand_export_files;
create trigger demand_export_files_updated_at
  before update on public.demand_export_files
  for each row execute function public.handle_updated_at();

alter table public.demand_export_files enable row level security;

drop policy if exists "Authenticated users can view demand export files" on public.demand_export_files;
create policy "Authenticated users can view demand export files"
  on public.demand_export_files for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert demand export files" on public.demand_export_files;
create policy "Authenticated users can insert demand export files"
  on public.demand_export_files for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update demand export files" on public.demand_export_files;
create policy "Authenticated users can update demand export files"
  on public.demand_export_files for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete demand export files" on public.demand_export_files;
create policy "Authenticated users can delete demand export files"
  on public.demand_export_files for delete
  to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'demand-exports',
  'demand-exports',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated can manage demand exports" on storage.objects;
create policy "Authenticated can manage demand exports"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'demand-exports')
  with check (bucket_id = 'demand-exports');

drop policy if exists "Public read for demand exports" on storage.objects;
create policy "Public read for demand exports"
  on storage.objects for select
  to public
  using (bucket_id = 'demand-exports');
