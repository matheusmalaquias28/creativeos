-- Prontidão do cliente: 1 referência basta.
--
-- O piso de 4 referências + 1 de estilo vinha de uma suposição sobre variedade
-- (cada arte irmã com um layout mestre diferente). Na prática ele trava o
-- onboarding de cliente novo, que é justamente quando se quer rodar a primeira
-- demanda — e o acervo cresce sozinho depois, com as artes aprovadas.
--
-- Com menos referências que artes, `enforceDistinctReferenceSets` simplesmente
-- repete mestres em vez de falhar, e a rotação por `usage_count` continua
-- preferindo o que está subusado. Nada quebra; a variedade só fica menor
-- enquanto o acervo for pequeno, o que é honesto.
--
-- DROP necessário: CREATE OR REPLACE não permite mudar colunas da view.

drop view if exists public.client_art_readiness;

create view public.client_art_readiness as
select
  c.id                                                    as client_id,
  c.name,
  coalesce(p.logo_url, nullif(trim(o.answers->>'logoUrl'), ''))  as logo_url,
  (coalesce(p.logo_url, nullif(trim(o.answers->>'logoUrl'), '')) is not null)
                                                          as has_logo,
  (greatest(
    case when jsonb_typeof(p.palette) = 'array'
         then jsonb_array_length(p.palette) else 0 end,
    case when jsonb_typeof(p.visual_identity_dna->'palette') = 'array'
         then jsonb_array_length(p.visual_identity_dna->'palette') else 0 end
  ) >= 2)                                                 as has_palette,
  (p.identity_extraction_status = 'ready'
    and p.visual_identity_dna is not null)                as has_dna,
  coalesce(r.total, 0)                                    as reference_count,
  coalesce(r.style_total, 0)                              as style_reference_count,
  (
    coalesce(p.logo_url, nullif(trim(o.answers->>'logoUrl'), '')) is not null
    and greatest(
      case when jsonb_typeof(p.palette) = 'array'
           then jsonb_array_length(p.palette) else 0 end,
      case when jsonb_typeof(p.visual_identity_dna->'palette') = 'array'
           then jsonb_array_length(p.visual_identity_dna->'palette') else 0 end
    ) >= 2
    and p.identity_extraction_status = 'ready'
    and p.visual_identity_dna is not null
    -- Era: r.total >= 4 and r.style_total >= 1
    and coalesce(r.total, 0) >= 1
  )                                                       as is_ready
from public.clients c
left join public.client_creative_profile p on p.client_id = c.id
left join public.onboarding_answers o on o.client_id = c.id
left join lateral (
  select
    count(*)                                   as total,
    count(*) filter (where a.kind = 'estilo')  as style_total
  from public.client_reference_asset a
  where a.client_id = c.id and a.active
) r on true;
