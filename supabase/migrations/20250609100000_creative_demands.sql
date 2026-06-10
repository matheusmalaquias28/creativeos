-- Demandas criativas recebidas via webhook (Make / plataforma externa)

create table public.creative_demands (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  client_name_external text not null,
  client_not_found boolean not null default false,
  tipo text,
  squad text,
  gestor text,
  webdesigner text,
  solicitante text,
  briefing jsonb not null default '{}'::jsonb,
  artes jsonb not null default '[]'::jsonb,
  status text,
  due_date timestamptz,
  external_created_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creative_demands_client_id_idx on public.creative_demands (client_id);
create index creative_demands_client_not_found_idx on public.creative_demands (client_not_found);
create index creative_demands_external_created_at_idx on public.creative_demands (external_created_at desc nulls last);
create index creative_demands_created_at_idx on public.creative_demands (created_at desc);

create trigger creative_demands_updated_at
  before update on public.creative_demands
  for each row execute function public.handle_updated_at();

alter table public.creative_demands enable row level security;

create policy "Authenticated users can view demands"
  on public.creative_demands for select
  to authenticated
  using (true);
