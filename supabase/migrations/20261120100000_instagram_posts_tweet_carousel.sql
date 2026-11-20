-- "Publicar no Instagram" também para o carrossel estilo tweet. O post aponta
-- para o carrossel tweet (cards renderizados no navegador, igual ao Studio).

alter table public.instagram_posts
  add column if not exists tweet_carousel_id uuid references public.tweet_carousels(id) on delete set null;

create index if not exists instagram_posts_tweet_carousel_idx
  on public.instagram_posts (tweet_carousel_id, created_at desc);
