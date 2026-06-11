-- Allow authenticated users to update demands (status, archive, timer fields)

alter table public.creative_demands
  add column if not exists is_archived boolean not null default false,
  add column if not exists is_new boolean not null default true,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists elapsed_seconds integer;

create policy "Authenticated users can update demands"
  on public.creative_demands for update
  to authenticated
  using (true)
  with check (true);
