-- Progresso da organização em chunks: quantos trechos do docx já viraram páginas.
-- Permite retomar a organização de onde parou em vez de recomeçar do zero.

alter table public.mvp_projects
  add column organize_progress integer not null default 0;
