-- Generated creatives (Fase 3a — Nano Banana / Gemini Image)

create table public.generated_creatives (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  creative_brain_id uuid references public.creative_brains (id) on delete set null,
  template_name text,
  prompt_payload jsonb not null default '{}'::jsonb,
  storage_path text not null,
  public_url text not null,
  mime_type text not null default 'image/png',
  aspect_ratio text,
  model text not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index generated_creatives_client_id_idx on public.generated_creatives (client_id);
create index generated_creatives_created_at_idx on public.generated_creatives (created_at desc);

alter table public.generated_creatives enable row level security;

create policy "Users can view creatives of own clients"
  on public.generated_creatives for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert creatives for own clients"
  on public.generated_creatives for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete creatives of own clients"
  on public.generated_creatives for delete
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-creatives',
  'generated-creatives',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can upload own generated creatives"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'generated-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own generated creatives"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read generated creatives"
  on storage.objects for select
  to public
  using (bucket_id = 'generated-creatives');

create policy "Users can delete own generated creatives storage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'generated-creatives'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
