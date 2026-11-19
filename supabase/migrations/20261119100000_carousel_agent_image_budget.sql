-- Teto de gasto do Agente de Carrossel: cada imagem gerada pelo GPT Image
-- reserva uma vaga aqui ANTES de chamar a API. A reserva é atômica (lock), então
-- vários carrosséis gerando juntos não passam do limite das últimas 24h.
-- Carrossel tweet não gera imagem e não entra na conta.

create table if not exists public.carousel_agent_image_usage (
  id bigserial primary key,
  run_id uuid references public.carousel_agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists carousel_agent_image_usage_created_idx
  on public.carousel_agent_image_usage (created_at desc);

-- Só o servidor (service role) lê e escreve.
alter table public.carousel_agent_image_usage enable row level security;

create or replace function public.reserve_carousel_agent_image(p_run_id uuid, p_daily_limit int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used int;
begin
  perform pg_advisory_xact_lock(hashtext('carousel_agent_image_budget'));
  select count(*) into used
  from public.carousel_agent_image_usage
  where created_at > now() - interval '24 hours';
  if used >= p_daily_limit then
    return false;
  end if;
  insert into public.carousel_agent_image_usage (run_id) values (p_run_id);
  return true;
end;
$$;

revoke execute on function public.reserve_carousel_agent_image(uuid, int) from public, anon, authenticated;
grant execute on function public.reserve_carousel_agent_image(uuid, int) to service_role;
