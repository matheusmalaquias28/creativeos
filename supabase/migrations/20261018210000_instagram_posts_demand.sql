-- Instagram também para demandas normais (botão ao lado de "Entregar demanda").
-- O post passa a apontar para a demanda; posts do Studio também gravam a
-- demanda do carrossel, então o histórico da página da demanda mostra os dois.

alter table public.instagram_posts
  add column if not exists demand_id uuid references public.creative_demands(id) on delete set null;

create index if not exists instagram_posts_demand_idx
  on public.instagram_posts (demand_id, created_at desc);

-- Posts do Studio já existentes herdam a demanda do carrossel.
update public.instagram_posts p
set demand_id = s.demand_id
from public.studio_carousels s
where p.studio_carousel_id = s.id
  and p.demand_id is null
  and s.demand_id is not null;
