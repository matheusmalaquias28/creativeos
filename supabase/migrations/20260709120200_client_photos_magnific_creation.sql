-- Cache do id de "creation" no Magnific, pra não reenviar a mesma foto em toda geração

alter table public.client_photos add column magnific_creation_id text;
