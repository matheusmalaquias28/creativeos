-- Acervo global de imagens + referências por arte com categoria.
--
-- O acervo (`image_library`) é compartilhado entre todos os clientes: o
-- operador sobe imagens uma vez (ex.: advogados, escritórios, tribunais) e
-- escolhe, em cada arte de cada demanda, qual imagem usar e COMO usá-la
-- (categoria). A escolha vira uma linha em `demand_reference_image` com
-- `arte_index` + `category`, e o generate-space.ts menciona essa imagem no
-- prompt do Space da arte correspondente.

-- ---------------------------------------------------------------------------
-- 1. Acervo global
-- ---------------------------------------------------------------------------

create table if not exists public.image_library (
  id uuid primary key default gen_random_uuid(),

  storage_url text not null,
  storage_path text not null,
  file_name text,
  width integer,
  height integer,

  -- Anotação por IA no upload — é o que alimenta a busca por texto.
  ai_description text,
  ai_tags text[] not null default '{}',
  suggested_category text
    check (suggested_category in ('subject', 'brand', 'style', 'environment')),
  annotation_status text not null default 'idle'
    check (annotation_status in ('idle', 'annotating', 'ready', 'failed')),
  annotation_error text,

  usage_count integer not null default 0,
  last_used_at timestamptz,

  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists image_library_active_idx
  on public.image_library (active, created_at desc);

drop trigger if exists image_library_updated_at on public.image_library;
create trigger image_library_updated_at
  before update on public.image_library
  for each row execute function public.handle_updated_at();

alter table public.image_library enable row level security;

drop policy if exists "Authenticated users can view image library" on public.image_library;
create policy "Authenticated users can view image library"
  on public.image_library for select to authenticated using (true);
drop policy if exists "Authenticated users can insert image library" on public.image_library;
create policy "Authenticated users can insert image library"
  on public.image_library for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update image library" on public.image_library;
create policy "Authenticated users can update image library"
  on public.image_library for update to authenticated using (true);
drop policy if exists "Authenticated users can delete image library" on public.image_library;
create policy "Authenticated users can delete image library"
  on public.image_library for delete to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'image-library',
  'image-library',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated can upload image library" on storage.objects;
create policy "Authenticated can upload image library"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'image-library');

drop policy if exists "Public read for image library" on storage.objects;
create policy "Public read for image library"
  on storage.objects for select to public
  using (bucket_id = 'image-library');

drop policy if exists "Authenticated can delete image library" on storage.objects;
create policy "Authenticated can delete image library"
  on storage.objects for delete to authenticated
  using (bucket_id = 'image-library');

-- ---------------------------------------------------------------------------
-- 2. Referências por arte, com categoria de uso
-- ---------------------------------------------------------------------------
--
-- arte_index null  → referência geral da demanda (comportamento de antes).
-- arte_index >= 0  → referência só daquela arte, mencionada no prompt do Space.

alter table public.demand_reference_image
  add column if not exists arte_index integer
    check (arte_index is null or arte_index >= 0),
  add column if not exists category text
    check (category in ('subject', 'brand', 'style', 'environment')),
  add column if not exists library_image_id uuid
    references public.image_library (id) on delete set null;

create index if not exists demand_reference_image_arte_idx
  on public.demand_reference_image (demand_id, arte_index);
