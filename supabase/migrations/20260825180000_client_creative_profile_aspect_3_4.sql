-- Padrão de feed vertical (3:4) em vez de quadrado 1:1
alter table public.client_creative_profile
  alter column aspect_ratio set default '3:4';

update public.client_creative_profile
set aspect_ratio = '3:4'
where aspect_ratio = '1:1';
