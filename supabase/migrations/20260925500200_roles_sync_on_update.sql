-- O GoTrue grava app_metadata num UPDATE logo após o INSERT; mantém public.users.role em sincronia.
create or replace function public.sync_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_app_meta_data ->> 'role', '');
begin
  update public.users
    set role = case
      when requested in ('super_admin', 'admin', 'carousel_creator') then requested::public.user_role
      else 'member'::public.user_role
    end
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_role_changed on auth.users;
create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data ->> 'role' is distinct from new.raw_app_meta_data ->> 'role')
  execute function public.sync_user_role();
