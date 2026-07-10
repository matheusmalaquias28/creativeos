create table public.client_magnific_space (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  space_id text not null,
  space_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_magnific_space_updated_at
  before update on public.client_magnific_space
  for each row execute function public.handle_updated_at();

alter table public.client_magnific_space enable row level security;

create policy "Authenticated users can view client magnific spaces"
  on public.client_magnific_space for select to authenticated using (true);

create policy "Authenticated users can insert client magnific spaces"
  on public.client_magnific_space for insert to authenticated with check (true);

create policy "Authenticated users can update client magnific spaces"
  on public.client_magnific_space for update to authenticated using (true);
