-- Permite que usuários autenticados criem o próprio perfil (ex.: signup via API admin sem trigger)

create policy "Users can insert own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);
