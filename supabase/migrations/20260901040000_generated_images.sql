-- Galeria: registro central de todas as imagens geradas na plataforma.
-- As imagens da Magnific vêm em URLs de CDN temporárias — aqui elas são
-- persistidas no Storage (bucket generated-images) e indexadas nesta tabela.

create table public.generated_images (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  source       text        not null default 'gerador',  -- 'carousel-turbo' | 'carousel-editor' | 'gerador' | 'artes'
  prompt       text        not null default '',
  aspect_ratio text        not null default '1:1',
  resolution   text        not null default '2K',
  storage_path text,                                     -- null quando só referenciamos uma URL externa
  url          text        not null,
  created_at   timestamptz not null default now()
);

create index generated_images_created_at_idx on public.generated_images (created_at desc);
create index generated_images_source_idx on public.generated_images (source);

alter table public.generated_images enable row level security;

create policy "Authenticated users can view generated images"
  on public.generated_images for select
  to authenticated using (true);

create policy "Authenticated users can insert generated images"
  on public.generated_images for insert
  to authenticated with check (true);

create policy "Authenticated users can delete generated images"
  on public.generated_images for delete
  to authenticated using (true);

-- Bucket público para as imagens persistidas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-images',
  'generated-images',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Public read for generated images"
  on storage.objects for select
  to public
  using (bucket_id = 'generated-images');
