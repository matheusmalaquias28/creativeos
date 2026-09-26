-- Roles: super_admin (gerencia usuários), admin (tudo), carousel_creator (só Carrosséis).
-- 'member' fica como legado, sem acesso a nenhuma área.
alter type public.user_role add value if not exists 'super_admin';
alter type public.user_role add value if not exists 'carousel_creator';
