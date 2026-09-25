-- Controle por arte das fotos reais do cliente + formato 3:4 fixo.

-- Algumas peças pedem o rosto do advogado, a maioria não. A decisão é por arte,
-- não por cliente nem por demanda — o operador vê a copy e decide na hora.
alter table public.art_generation_job
  add column if not exists use_client_photos boolean not null default false;

comment on column public.art_generation_job.use_client_photos is
  'Quando true, as fotos de client_photos entram como referência desta arte e o diretor de arte escreve a cena com a pessoa real.';

-- 3:4 passa a ser o padrão do perfil também. O default antigo era 1:1, e como
-- o worker lia profile.aspect_ratio, cliente antigo gerava fora do formato de
-- feed mesmo com a camada nova pedindo 3:4.
alter table public.client_creative_profile
  alter column aspect_ratio set default '3:4';

update public.client_creative_profile
set aspect_ratio = '3:4'
where aspect_ratio is distinct from '3:4';
