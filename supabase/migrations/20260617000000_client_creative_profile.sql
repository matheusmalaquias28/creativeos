-- Perfil criativo do cliente para geração de artes em lote

create table public.client_creative_profile (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  base_prompt text not null default '',
  palette jsonb not null default '[]'::jsonb,         -- array de hex strings, ex: ["#1A2B3C","#FF8800"]
  style_reference_urls jsonb not null default '[]'::jsonb, -- array de URLs do Supabase Storage
  logo_url text,
  logo_mode text not null default 'composite'         -- 'reference' | 'composite'
    check (logo_mode in ('reference', 'composite')),
  logo_placement jsonb not null default '{}'::jsonb,  -- { position, width, height, margin }
  image_size text not null default '2K'
    check (image_size in ('1K', '2K', '4K')),
  aspect_ratio text not null default '1:1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_creative_profile_updated_at
  before update on public.client_creative_profile
  for each row execute function public.handle_updated_at();

alter table public.client_creative_profile enable row level security;

create policy "Authenticated users can view creative profiles"
  on public.client_creative_profile for select
  to authenticated using (true);

create policy "Authenticated users can insert creative profiles"
  on public.client_creative_profile for insert
  to authenticated with check (true);

create policy "Authenticated users can update creative profiles"
  on public.client_creative_profile for update
  to authenticated using (true);
