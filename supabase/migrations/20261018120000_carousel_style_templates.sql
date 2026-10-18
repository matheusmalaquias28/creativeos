-- Páginas-modelo dos estilos de carrossel.
--
-- O conjunto de páginas-modelo de um estilo é um documento do próprio
-- Carrossel Studio (uma linha de studio_carousels sem demanda), editado no
-- mesmo editor. As camadas marcadas com `slot` são os campos que a IA
-- preenche em cada carrossel; o resto é decoração fixa do estilo.

alter table public.studio_carousels
  add column if not exists style_template_for uuid
    references public.carousel_styles (id) on delete cascade;

create unique index if not exists studio_carousels_style_template_idx
  on public.studio_carousels (style_template_for)
  where style_template_for is not null;
