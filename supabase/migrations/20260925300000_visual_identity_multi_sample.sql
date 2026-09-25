-- Extrator de identidade visual passa a aceitar várias artes de referência em
-- vez de uma só — o DNA extraído passa a ser uma síntese do conjunto, não a
-- leitura de uma peça isolada. As colunas escalares antigas
-- (identity_sample_url/identity_sample_storage_path) ficam no lugar sem uso
-- (nenhum código novo lê/escreve nelas) em vez de dropadas, pra não quebrar
-- nada que ainda dependa delas fora do app.

alter table public.client_creative_profile
  add column if not exists identity_sample_urls jsonb not null default '[]'::jsonb,
  add column if not exists identity_sample_storage_paths jsonb not null default '[]'::jsonb;

update public.client_creative_profile
set
  identity_sample_urls = case
    when identity_sample_url is not null then jsonb_build_array(identity_sample_url)
    else '[]'::jsonb
  end,
  identity_sample_storage_paths = case
    when identity_sample_storage_path is not null then jsonb_build_array(identity_sample_storage_path)
    else '[]'::jsonb
  end
where jsonb_array_length(identity_sample_urls) = 0
  and identity_sample_url is not null;
