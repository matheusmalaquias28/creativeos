-- Tabela de fotos complementares do cliente (produto, espaço, etc.)

create table public.client_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index client_photos_client_id_idx on public.client_photos (client_id);

alter table public.client_photos enable row level security;

create policy "Users can view photos of own clients"
  on public.client_photos for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert photos for own clients"
  on public.client_photos for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete photos of own clients"
  on public.client_photos for delete
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );
