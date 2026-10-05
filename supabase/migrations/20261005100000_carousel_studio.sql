-- Carrossel Studio: gerador automático + editor em camadas (estilo Figma).
--
-- Diferente dos `carousels` (slides com campos fixos), aqui o carrossel é um
-- DOCUMENTO de camadas: cada página tem imagens, textos, formas e botões com
-- posição/tamanho/rotação próprios. A IA gera o fundo e os elementos como
-- imagens SEM texto; todo texto, botão e logo é camada de código — editável.
--
-- Uma demanda do tipo Carrossel tem no máximo um studio (unique em demand_id).
-- A geração roda em background (after()) e escreve o progresso em
-- `generation`; o front acompanha via Realtime.

create table if not exists public.studio_carousels (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid unique references public.creative_demands(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null default 'Carrossel',
  format text not null default '4:5',
  status text not null default 'idle',
  document jsonb not null default '{}'::jsonb,
  -- Snapshot do kit de marca usado na última geração (logo, paleta, fontes).
  brand jsonb not null default '{}'::jsonb,
  -- Referências extras só deste carrossel (além das da ficha e da demanda).
  reference_urls jsonb not null default '[]'::jsonb,
  -- Instrução livre do operador para a próxima geração.
  brief text,
  caption text,
  generation jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_carousels
  drop constraint if exists studio_carousels_status_check;
alter table public.studio_carousels
  add constraint studio_carousels_status_check
    check (status in ('idle', 'queued', 'generating', 'ready', 'failed'));

alter table public.studio_carousels
  drop constraint if exists studio_carousels_format_check;
alter table public.studio_carousels
  add constraint studio_carousels_format_check
    check (format in ('4:5', '1:1', '9:16'));

create index if not exists studio_carousels_client_id_idx
  on public.studio_carousels (client_id);
create index if not exists studio_carousels_updated_at_idx
  on public.studio_carousels (updated_at desc);

drop trigger if exists studio_carousels_updated_at on public.studio_carousels;
create trigger studio_carousels_updated_at
  before update on public.studio_carousels
  for each row execute function public.handle_updated_at();

-- Mesmo modelo das demandas: o time inteiro enxerga e edita.
alter table public.studio_carousels enable row level security;

drop policy if exists "Authenticated users can view studio carousels" on public.studio_carousels;
create policy "Authenticated users can view studio carousels"
  on public.studio_carousels for select to authenticated using (true);

drop policy if exists "Authenticated users can insert studio carousels" on public.studio_carousels;
create policy "Authenticated users can insert studio carousels"
  on public.studio_carousels for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update studio carousels" on public.studio_carousels;
create policy "Authenticated users can update studio carousels"
  on public.studio_carousels for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete studio carousels" on public.studio_carousels;
create policy "Authenticated users can delete studio carousels"
  on public.studio_carousels for delete to authenticated using (true);

-- Realtime: progresso da geração aparece ao vivo na demanda e no editor.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_carousels'
  ) then
    alter publication supabase_realtime add table public.studio_carousels;
  end if;
end $$;
