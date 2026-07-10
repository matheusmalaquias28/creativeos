-- Declara formalmente a coluna flow_graph, que já existe em produção sem migration
-- rastreada (herdada de um merge anterior). Idempotente para bancos onde já existe.

alter table public.creative_demands add column if not exists flow_graph jsonb;
