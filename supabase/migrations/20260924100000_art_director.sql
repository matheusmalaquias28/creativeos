-- Camada de direção de arte por IA.
--
-- Aditivo por construção: não altera nada do caminho Magnific Spaces
-- (magnific_space*, client_magnific_space, generate-space.ts) nem do
-- /api/art-gen/queue atual, que continuam funcionando como estão.

-- ---------------------------------------------------------------------------
-- 1. Acervo de referências por cliente
-- ---------------------------------------------------------------------------

create table if not exists public.client_reference_asset (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,

  kind text not null default 'estilo'
    check (kind in ('estilo', 'layout', 'tipografia', 'personagem', 'produto', 'textura')),

  storage_url text not null,
  storage_path text,
  file_name text,

  -- Anotação por IA de visão no upload. Transforma seleção de referência em
  -- problema de texto: o diretor de arte lê o catálogo, não as imagens.
  ai_description text,
  ai_tags text[] not null default '{}',
  dominant_colors jsonb not null default '[]'::jsonb,
  annotation_status text not null default 'idle'
    check (annotation_status in ('idle', 'annotating', 'ready', 'failed')),
  annotation_error text,

  -- Controle de rotação: o catálogo mostra isso ao modelo para ele preferir
  -- o que está subusado.
  usage_count integer not null default 0,
  last_used_at timestamptz,

  -- Arte aprovada promovida ao acervo (ver quota em lib/ai/art-director/catalog.ts).
  is_winner boolean not null default false,

  active boolean not null default true,
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_reference_asset_client_idx
  on public.client_reference_asset (client_id, active);
create index if not exists client_reference_asset_kind_idx
  on public.client_reference_asset (client_id, kind) where active;

drop trigger if exists client_reference_asset_updated_at on public.client_reference_asset;
create trigger client_reference_asset_updated_at
  before update on public.client_reference_asset
  for each row execute function public.handle_updated_at();

alter table public.client_reference_asset enable row level security;

drop policy if exists "Authenticated users can view reference assets" on public.client_reference_asset;
create policy "Authenticated users can view reference assets"
  on public.client_reference_asset for select to authenticated using (true);
drop policy if exists "Authenticated users can insert reference assets" on public.client_reference_asset;
create policy "Authenticated users can insert reference assets"
  on public.client_reference_asset for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update reference assets" on public.client_reference_asset;
create policy "Authenticated users can update reference assets"
  on public.client_reference_asset for update to authenticated using (true);
drop policy if exists "Authenticated users can delete reference assets" on public.client_reference_asset;
create policy "Authenticated users can delete reference assets"
  on public.client_reference_asset for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. Referências resolvidas por arte
-- ---------------------------------------------------------------------------
--
-- Fonte única da ordem das referências: a ordem das linhas aqui é a ordem das
-- InlineDataParts enviadas ao modelo E a ordem enumerada no bloco técnico do
-- prompt. Substitui a reconciliação manual entre style_reference_urls,
-- demand_reference_image, params.extra_reference_urls e params.flow_references.

create table if not exists public.art_job_reference (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.art_generation_job (id) on delete cascade,

  asset_id uuid references public.client_reference_asset (id) on delete set null,
  -- Desnormalizado de propósito: cobre upload pontual sem asset e mantém a
  -- referência resolvível mesmo se o asset for removido do acervo depois.
  storage_url text not null,

  role text not null
    check (role in ('logo', 'estilo', 'layout', 'tipografia', 'personagem', 'produto', 'textura')),

  -- O papel exato que esta imagem cumpre NESTA arte, escrito pela IA.
  intent text,

  position integer not null default 0,
  source text not null default 'ai'
    check (source in ('ai', 'manual', 'client_fixed')),

  created_at timestamptz not null default now()
);

-- Índice, não unique: reordenar pela UI reescreve todas as posições do job e
-- um unique(job_id, position) não-deferrable quebraria a troca.
create index if not exists art_job_reference_job_idx
  on public.art_job_reference (job_id, position);

alter table public.art_job_reference enable row level security;

drop policy if exists "Authenticated users can view art job references" on public.art_job_reference;
create policy "Authenticated users can view art job references"
  on public.art_job_reference for select to authenticated using (true);
drop policy if exists "Authenticated users can insert art job references" on public.art_job_reference;
create policy "Authenticated users can insert art job references"
  on public.art_job_reference for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update art job references" on public.art_job_reference;
create policy "Authenticated users can update art job references"
  on public.art_job_reference for update to authenticated using (true);
drop policy if exists "Authenticated users can delete art job references" on public.art_job_reference;
create policy "Authenticated users can delete art job references"
  on public.art_job_reference for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Gate de aprovação do prompt em art_generation_job
-- ---------------------------------------------------------------------------

alter table public.art_generation_job
  drop constraint if exists art_generation_job_status_check;

alter table public.art_generation_job
  add constraint art_generation_job_status_check check (status in (
    'draft',              -- job criado, prompt ainda não escrito
    'writing_prompt',     -- diretor de arte rodando
    'awaiting_approval',  -- prompt pronto, esperando o operador
    'queued',             -- aprovado (ou fluxo legado) — worker pode pegar
    'processing',
    'succeeded',
    'failed'
  ));

alter table public.art_generation_job
  add column if not exists prompt_draft text,
  add column if not exists prompt_edited text,
  add column if not exists prompt_approved_at timestamptz,
  add column if not exists prompt_approved_by uuid references auth.users (id) on delete set null,
  -- concept, differentiator, negative[], steer, modelo usado, timestamps
  add column if not exists direction jsonb;

create index if not exists art_generation_job_awaiting_idx
  on public.art_generation_job (demand_id)
  where status = 'awaiting_approval';

-- ---------------------------------------------------------------------------
-- 4. Notas de direção por cliente (loop de aprendizado)
-- ---------------------------------------------------------------------------

alter table public.client_creative_profile
  add column if not exists direction_notes jsonb not null default '[]'::jsonb;

comment on column public.client_creative_profile.direction_notes is
  'Regras curtas em linguagem natural destiladas dos steers e edições do operador. Formato: [{ note, source, hits, created_at }]';

-- ---------------------------------------------------------------------------
-- 5. Prontidão do cliente para geração com IA
-- ---------------------------------------------------------------------------

create or replace view public.client_art_readiness as
select
  c.id                                                            as client_id,
  c.name,
  (p.logo_url is not null)                                        as has_logo,
  (coalesce(jsonb_array_length(p.palette), 0) >= 2)               as has_palette,
  (p.identity_extraction_status = 'ready'
    and p.visual_identity_dna is not null)                        as has_dna,
  coalesce(r.total, 0)                                            as reference_count,
  coalesce(r.style_total, 0)                                      as style_reference_count,
  (
    p.logo_url is not null
    and coalesce(jsonb_array_length(p.palette), 0) >= 2
    and p.identity_extraction_status = 'ready'
    and p.visual_identity_dna is not null
    and coalesce(r.total, 0) >= 4
    and coalesce(r.style_total, 0) >= 1
  )                                                               as is_ready
from public.clients c
left join public.client_creative_profile p on p.client_id = c.id
left join lateral (
  select
    count(*)                                        as total,
    count(*) filter (where a.kind = 'estilo')       as style_total
  from public.client_reference_asset a
  where a.client_id = c.id and a.active
) r on true;

-- ---------------------------------------------------------------------------
-- 6. Bucket do acervo
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-reference-assets',
  'client-reference-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated can upload client reference assets" on storage.objects;
create policy "Authenticated can upload client reference assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'client-reference-assets');

drop policy if exists "Public read for client reference assets" on storage.objects;
create policy "Public read for client reference assets"
  on storage.objects for select to public
  using (bucket_id = 'client-reference-assets');

drop policy if exists "Authenticated can delete client reference assets" on storage.objects;
create policy "Authenticated can delete client reference assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-reference-assets');
