-- Jobs de geração de arte (uma linha por arte, fila via status)

create table public.art_generation_job (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.creative_demands (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  prompt_final text,
  params jsonb not null default '{}'::jsonb,   -- aspect_ratio, image_size, logo_mode, etc.
  error text,
  attempts integer not null default 0,
  art_index integer not null default 0,        -- posição da arte na demanda (0-based)
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index art_generation_job_demand_id_idx on public.art_generation_job (demand_id);
create index art_generation_job_status_idx on public.art_generation_job (status);
create index art_generation_job_client_id_idx on public.art_generation_job (client_id);

create trigger art_generation_job_updated_at
  before update on public.art_generation_job
  for each row execute function public.handle_updated_at();

alter table public.art_generation_job enable row level security;

create policy "Authenticated users can view art jobs"
  on public.art_generation_job for select
  to authenticated using (true);

create policy "Authenticated users can insert art jobs"
  on public.art_generation_job for insert
  to authenticated with check (true);

create policy "Authenticated users can update art jobs"
  on public.art_generation_job for update
  to authenticated using (true);

-- Habilita Realtime para notificação do frontend
alter publication supabase_realtime add table public.art_generation_job;
