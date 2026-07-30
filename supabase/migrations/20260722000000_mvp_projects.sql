-- Projetos de MVP: docx enviado -> páginas organizadas por IA -> Space no Magnific
-- (uma imagem gerada por página, com referências conectadas em cada node)

create table public.mvp_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  docx_file_name text,
  raw_content text,
  -- array de páginas: { index, title, blocks: [{ type, text }], reference_urls: [] }
  pages jsonb not null default '[]'::jsonb,
  logo_url text,
  status text not null default 'organizing'
    check (status in ('organizing', 'organized', 'organize_failed', 'generating', 'ready', 'failed')),
  error text,
  space_id text,
  space_url text,
  space_nodes jsonb,
  cancel_requested boolean not null default false,
  requested_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mvp_projects_user_idx on public.mvp_projects (user_id, created_at desc);

alter table public.mvp_projects enable row level security;

create policy "Users manage own mvp projects"
  on public.mvp_projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table public.mvp_projects;

-- Bucket para logo e referências dos MVPs (path: {user_id}/{project_id}/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mvp-assets',
  'mvp-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "Users can upload mvp assets to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'mvp-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read for mvp assets"
  on storage.objects for select
  to public
  using (bucket_id = 'mvp-assets');

create policy "Users can delete own mvp assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'mvp-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
