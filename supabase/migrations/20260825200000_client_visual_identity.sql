-- Amostra de identidade visual + DNA extraído por IA (memória persistente do cliente)

alter table public.client_creative_profile
  add column if not exists identity_sample_url text,
  add column if not exists identity_sample_storage_path text,
  add column if not exists visual_identity_dna jsonb,
  add column if not exists identity_extracted_at timestamptz,
  add column if not exists identity_extraction_status text not null default 'idle'
    check (identity_extraction_status in ('idle', 'extracting', 'ready', 'failed')),
  add column if not exists identity_extraction_error text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-identity-samples',
  'client-identity-samples',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can upload own client identity samples"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-identity-samples'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own client identity samples"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-identity-samples'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read for client identity samples"
  on storage.objects for select
  to public
  using (bucket_id = 'client-identity-samples');

create policy "Users can delete own client identity samples"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-identity-samples'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
