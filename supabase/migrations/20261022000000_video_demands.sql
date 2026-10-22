-- Demandas de VÍDEO recebidas via webhook (WAR / Make).
--
-- Espelha o essencial de `creative_demands`, mas numa tabela separada: demandas
-- de vídeo (payload com `tipo: "video"`) têm briefing próprio (quantidade de
-- vídeos, prioridade, pastas de Drive, descrição) e NÃO usam o pipeline de artes
-- (Magnific Space / export). Mantê-las fora de `creative_demands` evita poluir o
-- Kanban de artes e os analytics com itens que não são artes.

create table public.video_demands (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  client_name_external text not null,
  client_not_found boolean not null default false,
  tipo text,
  categoria text,
  prioridade text,
  squad text,
  gestor text,
  webdesigner text,
  solicitante text,
  briefing jsonb not null default '{}'::jsonb,
  status text,
  is_archived boolean not null default false,
  is_new boolean not null default true,
  started_at timestamptz,
  completed_at timestamptz,
  elapsed_seconds integer,
  due_date timestamptz,
  external_created_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  drive_folder_url text,
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_demands_client_id_idx on public.video_demands (client_id);
create index video_demands_client_not_found_idx on public.video_demands (client_not_found);
create index video_demands_is_archived_idx on public.video_demands (is_archived);
create index video_demands_external_created_at_idx on public.video_demands (external_created_at desc nulls last);
create index video_demands_created_at_idx on public.video_demands (created_at desc);

create trigger video_demands_updated_at
  before update on public.video_demands
  for each row execute function public.handle_updated_at();

alter table public.video_demands enable row level security;

create policy "Authenticated users can view video demands"
  on public.video_demands for select
  to authenticated
  using (true);

create policy "Authenticated users can update video demands"
  on public.video_demands for update
  to authenticated
  using (true)
  with check (true);

-- Realtime para notificar a aba Vídeos de novas demandas e mudanças de status.
alter publication supabase_realtime add table public.video_demands;
