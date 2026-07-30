-- Geração do Space em lotes de 10 páginas: progresso persistido para o botão
-- dinâmico ("lote N de X") e para retomar de onde parou após falha/pausa.

alter table public.mvp_projects
  add column generated_batches integer not null default 0,
  add column total_batches integer not null default 0;
