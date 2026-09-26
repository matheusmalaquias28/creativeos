-- A role vem de auth.users.raw_app_meta_data->>'role' (só o service role escreve lá).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_app_meta_data ->> 'role', '');
  assigned_role public.user_role;
begin
  assigned_role := case
    when requested in ('super_admin', 'admin', 'carousel_creator') then requested::public.user_role
    else 'member'::public.user_role
  end;

  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    assigned_role
  )
  on conflict (id) do update set role = excluded.role;

  return new;
end;
$$;

-- Super administrador.
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
  where email = 'contato.matheusmalaquias@gmail.com';
update public.users set role = 'super_admin' where email = 'contato.matheusmalaquias@gmail.com';

-- Usuários sem role no app_metadata herdam a de public.users (fonte usada pelo middleware).
update auth.users a
  set raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', u.role::text)
  from public.users u
  where u.id = a.id and coalesce(a.raw_app_meta_data ->> 'role', '') = '';
