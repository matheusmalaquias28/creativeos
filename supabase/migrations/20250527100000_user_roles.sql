-- User roles (admin for dev / agency owners)

create type public.user_role as enum ('admin', 'member');

alter table public.users
  add column if not exists role public.user_role not null default 'member';

create index if not exists users_role_idx on public.users (role);

-- Sync role from app_metadata on signup (use app_metadata — not user_metadata — for auth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
begin
  assigned_role := case
    when coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then 'admin'::public.user_role
    else 'member'::public.user_role
  end;

  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    assigned_role
  );

  return new;
end;
$$;
