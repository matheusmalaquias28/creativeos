-- Bucket para logos de clientes (onboarding)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "Users can upload own client logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own client logos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own client logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read for client logos"
  on storage.objects for select
  to public
  using (bucket_id = 'client-logos');

create policy "Users can delete own client logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
