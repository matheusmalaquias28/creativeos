-- Estabiliza os dados por 10 minutos e encaminha uma demanda por tick ao agente
-- que opera o Storm. A geração e a aprovação não acontecem nesta migration.

create or replace function public.set_creative_demand_agent_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.art_auto_generation_status := 'pending';
    new.art_auto_generation_started_at := null;
    new.art_auto_generation_finished_at := null;
    new.art_auto_generation_error := null;
  elsif old.art_auto_generation_status in (
      'manual', 'pending', 'ready', 'processing', 'awaiting_agent',
      'awaiting_review', 'failed', 'blocked'
    ) and (new.client_id is distinct from old.client_id
      or new.briefing is distinct from old.briefing
      or new.artes is distinct from old.artes) then
    new.art_auto_generation_status := 'pending';
    new.art_auto_generation_started_at := null;
    new.art_auto_generation_finished_at := null;
    new.art_auto_generation_error := null;
  end if;
  return new;
end;
$$;

drop trigger if exists creative_demands_art_auto_status on public.creative_demands;
drop trigger if exists creative_demands_agent_status on public.creative_demands;
create trigger creative_demands_agent_status
  before insert or update of client_id, briefing, artes on public.creative_demands
  for each row execute function public.set_creative_demand_agent_status();

create index if not exists creative_demands_agent_queue_idx
  on public.creative_demands (art_auto_generation_status, updated_at, created_at)
  where is_archived = false;

create or replace function public.claim_creative_demand_agent_task(
  p_now timestamptz default now()
)
returns table (
  result_demand_id uuid,
  result_external_id text,
  result_action text,
  result_error text
)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_daily_count integer;
  v_initial_status text := 'Aguardando Defini' || chr(231) || chr(227) || 'o de Data';
begin
  perform pg_advisory_xact_lock(hashtext('creative-demand-agent-queue'));

  select count(*)::integer
    into v_daily_count
  from public.creative_demands d
  where d.art_auto_generation_started_at is not null
    and (d.art_auto_generation_started_at at time zone 'America/Sao_Paulo')::date =
        (p_now at time zone 'America/Sao_Paulo')::date;

  -- Limite operacional: no máximo seis tarefas encaminhadas por dia.
  if v_daily_count >= 6 then return; end if;

  for v_item in
    select d.id, d.external_id, d.status,
           case when jsonb_typeof(d.artes) = 'array'
             then jsonb_array_length(d.artes) else 0 end as art_count
    from public.creative_demands d
    where not d.is_archived
      and d.client_id is not null
      and d.status in (
        v_initial_status, 'Falta material do cliente', 'Em Fila', 'Fazendo', 'Ajuste'
      )
      and d.art_auto_generation_status in ('pending', 'ready')
      and (
        d.art_auto_generation_status = 'ready'
        or d.updated_at <= p_now - interval '10 minutes'
      )
    order by coalesce(d.external_created_at, d.created_at), d.id
    for update of d skip locked
  loop
    if v_item.art_count < 1 or v_item.art_count > 5 then
      update public.creative_demands d
      set art_auto_generation_status = 'blocked',
          art_auto_generation_finished_at = p_now,
          art_auto_generation_error = 'O fluxo do agente aceita de 1 a 5 artes por demanda.'
      where d.id = v_item.id;

      result_demand_id := v_item.id;
      result_external_id := v_item.external_id;
      result_action := 'blocked';
      result_error := 'O fluxo do agente aceita de 1 a 5 artes por demanda.';
      return next;
      return;
    end if;

    update public.creative_demands d
    set art_auto_generation_status = 'processing',
        art_auto_generation_started_at = p_now,
        art_auto_generation_finished_at = null,
        art_auto_generation_error = null
    where d.id = v_item.id
      and d.art_auto_generation_status in ('pending', 'ready')
    returning d.id, d.external_id
      into result_demand_id, result_external_id;

    if found then
      result_action := case
        when v_item.status = 'Falta material do cliente' then 'missing_material'
        else 'claimed'
      end;
      result_error := null;
      return next;
      return;
    end if;
  end loop;
end;
$$;

revoke all on function public.claim_creative_demand_agent_task(timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_creative_demand_agent_task(timestamptz)
  to service_role;
