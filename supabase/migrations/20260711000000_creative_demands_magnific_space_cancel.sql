alter table public.creative_demands
  add column if not exists magnific_space_cancel_requested boolean not null default false;
