-- Corrige a prontidão do cliente: logo e paleta vinham de uma coluna que só é
-- preenchida em uploads NOVOS.
--
-- A logo real do cliente vive em `onboarding_answers.answers->>'logoUrl'`.
-- `client_creative_profile.logo_url` só passa a existir quando
-- `syncLogoToCreativeProfile()` roda — ou seja, a partir do próximo upload.
-- Clientes cadastrados antes disso têm logo, mas a view dizia que não.
--
-- Mesma história na paleta: `runIdentityExtraction()` grava `palette` a partir
-- do `visual_identity_dna` extraído da arte de referência, mas perfis extraídos
-- antes (ou com a coluna limpa depois) ficaram só com o DNA.

-- ---------------------------------------------------------------------------
-- 1. Backfill da logo a partir do onboarding
-- ---------------------------------------------------------------------------

-- Cria o perfil criativo para clientes que têm logo no onboarding mas nunca
-- tiveram perfil — senão o upsert de logo não tem linha onde pousar.
insert into public.client_creative_profile (client_id, logo_url)
select o.client_id, o.answers->>'logoUrl'
from public.onboarding_answers o
where nullif(trim(o.answers->>'logoUrl'), '') is not null
  and not exists (
    select 1 from public.client_creative_profile p where p.client_id = o.client_id
  )
on conflict (client_id) do nothing;

update public.client_creative_profile p
set logo_url = o.answers->>'logoUrl'
from public.onboarding_answers o
where o.client_id = p.client_id
  and p.logo_url is null
  and nullif(trim(o.answers->>'logoUrl'), '') is not null;

-- ---------------------------------------------------------------------------
-- 2. Backfill da paleta a partir do DNA visual já extraído
-- ---------------------------------------------------------------------------

update public.client_creative_profile
set palette = visual_identity_dna->'palette'
where jsonb_typeof(visual_identity_dna->'palette') = 'array'
  and jsonb_array_length(visual_identity_dna->'palette') > 0
  and coalesce(jsonb_array_length(
        case when jsonb_typeof(palette) = 'array' then palette else '[]'::jsonb end
      ), 0) = 0;

-- ---------------------------------------------------------------------------
-- 3. View que não mente mais
-- ---------------------------------------------------------------------------
--
-- Passa a ler as duas origens em vez de depender de o backfill ter rodado:
-- um cliente novo cujo perfil ainda não sincronizou continua contando como
-- pronto, e `logo_url` devolve a logo efetiva para o worker compor.
--
-- DROP necessário: CREATE OR REPLACE não permite renomear/reordenar colunas da view.

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
    and coalesce(r.total, 0) >= 4
    and coalesce(r.style_total, 0) >= 1
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
