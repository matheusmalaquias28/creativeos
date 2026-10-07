-- Imagem de origem de uma versão gerada em fan-out (item da Lista). Permite
-- saber de qual arte do feed cada story veio — usado para mandar cada story
-- para o slot certo (Arte N / Stories) na entrega ao Drive.
alter table public.art_version add column if not exists source_url text;
