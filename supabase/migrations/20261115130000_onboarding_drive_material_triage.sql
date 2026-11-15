-- Onboarding requires an actual Drive Materiais check before assigning a date.
-- The database only knows whether a logo is registered in CreativeOS/Storm.
create or replace function public.assign_creative_demand_due_dates(
  p_now timestamptz default now()
)
returns table (
  result_demand_id uuid,
  result_external_id text,
  result_action text,
  result_status text,
  result_due_date timestamptz,
  result_raw_payload jsonb
)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_requested_local timestamp without time zone;
  v_today_local date;
  v_due_day date;
  v_daily_count integer;
  v_is_onboarding boolean;
  v_initial_status text := 'Aguardando Defini' || chr(231) || chr(227) || 'o de Data';
begin
  perform pg_advisory_xact_lock(hashtext('creative-demand-auto-due-dates'));

  for v_item in
    select
      d.id,
      d.external_id,
      d.client_id,
      d.status,
      d.raw_payload,
      d.external_created_at,
      d.created_at,
      d.art_auto_generation_status,
      d.art_auto_generation_finished_at,
      c.status as client_status,
      r.has_logo,
      greatest(
        coalesce(p.updated_at, '-infinity'::timestamptz),
        coalesce(o.updated_at, '-infinity'::timestamptz)
      ) as materials_updated_at
    from public.creative_demands d
    left join public.clients c on c.id = d.client_id
    left join public.client_art_readiness r on r.client_id = d.client_id
    left join public.client_creative_profile p on p.client_id = d.client_id
    left join public.onboarding_answers o on o.client_id = d.client_id
    where not d.is_archived
      and d.due_date is null
      and d.status in (v_initial_status, 'Falta material do cliente', 'Ajuste')
      and d.updated_at <= p_now - interval '10 minutes'
    order by coalesce(d.external_created_at, d.created_at), d.id
    for update of d
  loop
    v_is_onboarding := v_item.client_status = 'onboarding'
      or coalesce(
        v_item.raw_payload ->> 'categoria',
        v_item.raw_payload ->> 'category',
        v_item.raw_payload -> 'briefing' ->> 'categoria',
        ''
      ) ~* 'onboarding';

    if v_is_onboarding then
      if not coalesce(v_item.has_logo, false) then
        continue;
      end if;

      -- A blocked onboarding task is rearmed only after Storm receives newer
      -- client materials, which is the signal that the Drive check was resolved.
      if v_item.art_auto_generation_status = 'blocked'
        and v_item.materials_updated_at > coalesce(
          v_item.art_auto_generation_finished_at,
          '-infinity'::timestamptz
        ) then
        update public.creative_demands d
        set art_auto_generation_status = 'materials_ready',
            art_auto_generation_finished_at = null,
            art_auto_generation_error = null
        where d.id = v_item.id and d.due_date is null;
        v_item.art_auto_generation_status := 'materials_ready';
      end if;

      -- An agent must verify Drive Materiais before setting materials_ready.
      if v_item.art_auto_generation_status <> 'materials_ready' then
        continue;
      end if;
    end if;

    v_requested_local := coalesce(v_item.external_created_at, v_item.created_at)
      at time zone 'America/Sao_Paulo';
    v_today_local := (p_now at time zone 'America/Sao_Paulo')::date;
    v_due_day := greatest(v_requested_local::date, v_today_local);
    if v_requested_local::time > time '16:00' then
      v_due_day := greatest(v_due_day, v_requested_local::date + 1);
    end if;

    loop
      if extract(isodow from v_due_day) between 1 and 5 then
        select count(*)::integer
          into v_daily_count
        from public.creative_demands d
        where not d.is_archived
          and d.due_date is not null
          and (d.due_date at time zone 'America/Sao_Paulo')::date = v_due_day;

        if v_daily_count < 5 then exit; end if;
      end if;
      v_due_day := v_due_day + 1;
    end loop;

    update public.creative_demands d
    set due_date = (v_due_day::timestamp + time '23:59') at time zone 'America/Sao_Paulo',
        status = case when v_item.status = 'Ajuste' then 'Ajuste' else 'Em Fila' end,
        art_auto_generation_status = case
          when d.art_auto_generation_status in ('pending', 'blocked', 'materials_ready') then 'ready'
          else d.art_auto_generation_status
        end,
        art_auto_generation_finished_at = case
          when d.art_auto_generation_status in ('pending', 'blocked', 'materials_ready') then null
          else d.art_auto_generation_finished_at
        end,
        art_auto_generation_error = case
          when d.art_auto_generation_status in ('pending', 'blocked', 'materials_ready') then null
          else d.art_auto_generation_error
        end,
        updated_at = p_now
    where d.id = v_item.id
      and d.due_date is null
      and d.status in (v_initial_status, 'Falta material do cliente', 'Ajuste')
    returning d.id, d.external_id, d.status, d.due_date, d.raw_payload
      into result_demand_id, result_external_id, result_status,
           result_due_date, result_raw_payload;

    if found then
      result_action := 'scheduled';
      return next;
    end if;
  end loop;
end;
$$;

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
  v_is_onboarding boolean;
begin
  perform pg_advisory_xact_lock(hashtext('creative-demand-agent-queue'));

  select count(*)::integer
    into v_daily_count
  from public.creative_demands d
  where d.art_auto_generation_started_at is not null
    and (d.art_auto_generation_started_at at time zone 'America/Sao_Paulo')::date =
        (p_now at time zone 'America/Sao_Paulo')::date;

  if v_daily_count >= 6 then return; end if;

  for v_item in
    select d.id, d.external_id, d.status, d.due_date, d.raw_payload,
           d.client_id,
           c.status as client_status,
           d.art_auto_generation_status,
           case when jsonb_typeof(d.artes) = 'array'
             then jsonb_array_length(d.artes) else 0 end as art_count
    from public.creative_demands d
    left join public.clients c on c.id = d.client_id
    where not d.is_archived
      and d.client_id is not null
      and d.status in (
        'Aguardando Defini' || chr(231) || chr(227) || 'o de Data',
        'Falta material do cliente', 'Em Fila', 'Fazendo', 'Ajuste'
      )
      and (
        d.art_auto_generation_status = 'ready'
        or (
          d.art_auto_generation_status = 'pending'
          and d.due_date is null
          and d.updated_at <= p_now - interval '10 minutes'
          and (
            c.status = 'onboarding'
            or coalesce(
              d.raw_payload ->> 'categoria',
              d.raw_payload ->> 'category',
              d.raw_payload -> 'briefing' ->> 'categoria',
              ''
            ) ~* 'onboarding'
          )
        )
      )
    order by coalesce(d.external_created_at, d.created_at), d.id
    for update of d skip locked
  loop
    if v_item.art_count < 1 or v_item.art_count > 5 then
      update public.creative_demands d
      set art_auto_generation_status = 'blocked',
          art_auto_generation_finished_at = p_now,
          art_auto_generation_started_at = null,
          art_auto_generation_error = 'O fluxo do agente aceita de 1 a 5 artes por demanda.'
      where d.id = v_item.id;

      result_demand_id := v_item.id;
      result_external_id := v_item.external_id;
      result_action := 'blocked';
      result_error := 'O fluxo do agente aceita de 1 a 5 artes por demanda.';
      return next;
      return;
    end if;

    v_is_onboarding := (
      v_item.client_status = 'onboarding'
      or coalesce(
        v_item.raw_payload ->> 'categoria',
        v_item.raw_payload ->> 'category',
        v_item.raw_payload -> 'briefing' ->> 'categoria',
        ''
      ) ~* 'onboarding'
    );

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
        when v_is_onboarding and v_item.due_date is null then 'check_materials'
        else 'claimed'
      end;
      result_error := null;
      return next;
      return;
    end if;
  end loop;
end;
$$;

revoke all on function public.assign_creative_demand_due_dates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.assign_creative_demand_due_dates(timestamptz)
  to service_role;
revoke all on function public.claim_creative_demand_agent_task(timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_creative_demand_agent_task(timestamptz)
  to service_role;
