-- Comentários das demandas vindos do WAR (evento `demanda.nota`).
--
-- O WAR manda cada comentário para o mesmo webhook das demandas
-- (/api/webhooks/make/demands) com `{ id, event: "demanda.nota", nota: { autor,
-- texto, imagens }, addedBy, createdAt }`. Antes eram só reconhecidos (para não
-- apagarem a demanda) e descartados; agora ficam aqui, ligados à demanda de arte
-- ou de vídeo pelo `external_id` do WAR. `external_demand_id` fica gravado mesmo
-- quando a demanda ainda não existe no CreativeOS, para o vínculo poder ser
-- refeito depois.

create table public.demand_comments (
  id uuid primary key default gen_random_uuid(),
  external_demand_id text not null,
  demand_id uuid references public.creative_demands (id) on delete cascade,
  video_demand_id uuid references public.video_demands (id) on delete cascade,
  source text not null default 'war',
  author text,
  body text not null default '',
  images jsonb not null default '[]'::jsonb,
  external_created_at timestamptz,
  dedupe_key text not null unique,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index demand_comments_demand_id_idx
  on public.demand_comments (demand_id, external_created_at);
create index demand_comments_video_demand_id_idx
  on public.demand_comments (video_demand_id, external_created_at);
create index demand_comments_external_demand_id_idx
  on public.demand_comments (external_demand_id);

alter table public.demand_comments enable row level security;

create policy "Authenticated users can view demand comments"
  on public.demand_comments for select
  to authenticated
  using (true);
