-- Bucket para fotos complementares do cliente (produto, espaço físico, etc.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-photos',
  'client-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can upload own client photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own client photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own client photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read for client photos"
  on storage.objects for select
  to public
  using (bucket_id = 'client-photos');

create policy "Users can delete own client photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
