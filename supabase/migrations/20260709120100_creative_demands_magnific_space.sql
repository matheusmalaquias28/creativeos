-- Rastreamento do Magnific Space gerado automaticamente por demanda

alter table public.creative_demands
  add column magnific_space_id text,
  add column magnific_space_url text,
  add column magnific_space_status text not null default 'not_generated'
    check (magnific_space_status in ('not_generated', 'generating', 'ready', 'failed')),
  add column magnific_space_error text,
  add column magnific_space_requested_at timestamptz,
  add column magnific_space_generated_at timestamptz;

create index creative_demands_magnific_space_status_idx
  on public.creative_demands (magnific_space_status);
