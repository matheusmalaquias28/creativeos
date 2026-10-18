-- Publicação de carrosséis do Studio no Instagram (botão "Publicar no Instagram").
--
-- Cada linha é um post: as imagens já renderizadas (JPEG no bucket público
-- `instagram-posts`, na ordem do carrossel), a legenda e quando publicar.
-- `scheduled_at` null = publicar agora. Nada publica sozinho: a linha só nasce
-- quando alguém clica em "Publicar agora" ou "Agendar". O cron só publica as
-- `scheduled` vencidas, e a troca para `publishing` é atômica (UPDATE … WHERE
-- status = 'scheduled'), então um post nunca sai duas vezes.
--
-- Conta: hoje é a conta única do env (INSTAGRAM_ACCESS_TOKEN). `ig_user_id` e
-- `ig_username` ficam gravados por post para depois trocar pela conta
-- conectada de cada cliente sem mudar a tabela.

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  studio_carousel_id uuid references public.studio_carousels(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  ig_user_id text not null,
  ig_username text,
  -- [{ "url": "https://…/card-01.jpg", "path": "<carousel>/<post>/card-01.jpg", "page_id": "…" }, …]
  items jsonb not null default '[]'::jsonb,
  caption text not null default '',
  scheduled_at timestamptz,
  status text not null default 'draft',
  media_id text,
  permalink text,
  error text,
  publishing_started_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instagram_posts
  drop constraint if exists instagram_posts_status_check;
alter table public.instagram_posts
  add constraint instagram_posts_status_check
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'canceled'));

alter table public.instagram_posts
  drop constraint if exists instagram_posts_caption_length;
alter table public.instagram_posts
  add constraint instagram_posts_caption_length check (char_length(caption) <= 2200);

create index if not exists instagram_posts_carousel_idx
  on public.instagram_posts (studio_carousel_id, created_at desc);
create index if not exists instagram_posts_due_idx
  on public.instagram_posts (scheduled_at)
  where status = 'scheduled';

drop trigger if exists instagram_posts_updated_at on public.instagram_posts;
create trigger instagram_posts_updated_at
  before update on public.instagram_posts
  for each row execute function public.handle_updated_at();

-- Mesmo modelo do Studio: o time inteiro enxerga. Escrita só pelo servidor
-- (service role), que é quem fala com a API do Instagram.
alter table public.instagram_posts enable row level security;

drop policy if exists "Authenticated users can view instagram posts" on public.instagram_posts;
create policy "Authenticated users can view instagram posts"
  on public.instagram_posts for select to authenticated using (true);

-- Realtime: o histórico na demanda/editor atualiza sozinho (agendado → publicado).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'instagram_posts'
  ) then
    alter publication supabase_realtime add table public.instagram_posts;
  end if;
end $$;

-- Bucket público: o Instagram baixa as imagens pela URL na hora de publicar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instagram-posts',
  'instagram-posts',
  true,
  8388608, -- 8 MB, o teto do Instagram
  array['image/jpeg']
)
on conflict (id) do nothing;

drop policy if exists "Public read for instagram-posts" on storage.objects;
create policy "Public read for instagram-posts"
  on storage.objects for select
  to public
  using (bucket_id = 'instagram-posts');
