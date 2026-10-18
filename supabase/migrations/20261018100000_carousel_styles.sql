-- Acervo de estilos de carrossel.
--
-- Um estilo ("Carrossel Creato") é um conjunto de artes de exemplo que mostram
-- a mesma identidade visual em vários cards. A IA lê todas as artes juntas uma
-- vez e grava o DNA do estilo (`dna`): grid, tipografia, uso de cor, elementos
-- recorrentes, como capa / miolo / CTA são montados. O diretor de arte do
-- Carrossel Studio recebe esse DNA + as artes em cada geração.
--
-- Global como o acervo de imagens: qualquer carrossel usa qualquer estilo; o
-- `client_id` é só um vínculo opcional (estilo feito para um cliente).

create table if not exists public.carousel_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  client_id uuid references public.clients (id) on delete set null,

  dna jsonb not null default '{}'::jsonb,
  analysis_status text not null default 'idle'
    check (analysis_status in ('idle', 'analyzing', 'ready', 'failed')),
  analysis_error text,
  analyzed_at timestamptz,

  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carousel_styles_active_idx
  on public.carousel_styles (active, updated_at desc);

drop trigger if exists carousel_styles_updated_at on public.carousel_styles;
create trigger carousel_styles_updated_at
  before update on public.carousel_styles
  for each row execute function public.handle_updated_at();

create table if not exists public.carousel_style_images (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.carousel_styles (id) on delete cascade,
  storage_url text not null,
  storage_path text not null,
  file_name text,
  width integer,
  height integer,
  -- Papel da arte no carrossel de exemplo; null = a IA deduz pela ordem.
  role text check (role in ('cover', 'inner', 'cta')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists carousel_style_images_style_idx
  on public.carousel_style_images (style_id, position);

-- Estilo usado na geração do carrossel.
alter table public.studio_carousels
  add column if not exists style_id uuid
    references public.carousel_styles (id) on delete set null;

-- RLS: o time inteiro enxerga e edita (mesmo modelo do acervo).
alter table public.carousel_styles enable row level security;
alter table public.carousel_style_images enable row level security;

drop policy if exists "Authenticated users can view carousel styles" on public.carousel_styles;
create policy "Authenticated users can view carousel styles"
  on public.carousel_styles for select to authenticated using (true);
drop policy if exists "Authenticated users can insert carousel styles" on public.carousel_styles;
create policy "Authenticated users can insert carousel styles"
  on public.carousel_styles for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update carousel styles" on public.carousel_styles;
create policy "Authenticated users can update carousel styles"
  on public.carousel_styles for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can delete carousel styles" on public.carousel_styles;
create policy "Authenticated users can delete carousel styles"
  on public.carousel_styles for delete to authenticated using (true);

drop policy if exists "Authenticated users can view carousel style images" on public.carousel_style_images;
create policy "Authenticated users can view carousel style images"
  on public.carousel_style_images for select to authenticated using (true);
drop policy if exists "Authenticated users can insert carousel style images" on public.carousel_style_images;
create policy "Authenticated users can insert carousel style images"
  on public.carousel_style_images for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update carousel style images" on public.carousel_style_images;
create policy "Authenticated users can update carousel style images"
  on public.carousel_style_images for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can delete carousel style images" on public.carousel_style_images;
create policy "Authenticated users can delete carousel style images"
  on public.carousel_style_images for delete to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carousel-styles',
  'carousel-styles',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Public read for carousel styles" on storage.objects;
create policy "Public read for carousel styles"
  on storage.objects for select to public
  using (bucket_id = 'carousel-styles');
