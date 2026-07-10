-- Fluxo (canvas de nós) compartilhado por cliente — substitui o flow_graph por
-- demanda como fonte principal quando a demanda tem client_id.

create table public.client_flow_graph (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_flow_graph_updated_at
  before update on public.client_flow_graph
  for each row execute function public.handle_updated_at();

alter table public.client_flow_graph enable row level security;

create policy "Authenticated users can view client flow graphs"
  on public.client_flow_graph for select
  to authenticated using (true);

create policy "Authenticated users can insert client flow graphs"
  on public.client_flow_graph for insert
  to authenticated with check (true);

create policy "Authenticated users can update client flow graphs"
  on public.client_flow_graph for update
  to authenticated using (true);
