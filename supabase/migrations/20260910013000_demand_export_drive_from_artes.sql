-- Pasta do Drive costuma vir em artes[].linkReferencias, não só no briefing.

with links as (
  select
    d.id,
    elem->>'linkReferencias' as url
  from public.creative_demands d
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(d.artes::jsonb) = 'array' then d.artes::jsonb
      else '[]'::jsonb
    end
  ) elem
),
resolved as (
  select distinct on (id)
    id,
    url,
    coalesce(
      (regexp_match(url, '/folders/([a-zA-Z0-9_-]{10,})'))[1],
      (regexp_match(url, '[?&]id=([a-zA-Z0-9_-]{10,})'))[1]
    ) as folder_id
  from links
  where url ~* 'drive.google.com'
  order by id, folder_id nulls last
)
update public.creative_demands d
set
  drive_folder_url = src.url,
  drive_folder_id = src.folder_id
from resolved src
where d.id = src.id
  and d.drive_folder_id is null
  and src.folder_id is not null;
