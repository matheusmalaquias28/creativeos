-- Avoid repeated agent webhooks while onboarding materials are missing, and
-- re-arm the internal queue when a logo is later added to the client profile.
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
      c.status as client_status,
      r.has_logo
    from public.creative_demands d
    left join public.clients c on c.id = d.client_id
    left join public.client_art_readiness r on r.client_id = d.client_id
    where not d.is_archived
      and d.due_date is null
      and d.status in (v_initial_status, 'Falta material do cliente', 'Ajuste')
      and d.updated_at <= p_now - interval '10 minutes'
    order by coalesce(d.external_created_at, d.created_at), d.id
    for update of d
  loop
    if (
      v_item.client_status = 'onboarding'
      or coalesce(
        v_item.raw_payload ->> 'categoria',
        v_item.raw_payload ->> 'category',
        v_item.raw_payload -> 'briefing' ->> 'categoria',
        ''
      ) ~* 'onboarding'
    ) and not coalesce(v_item.has_logo, false) then
      -- Emit one material-check task. The agent marks the internal queue blocked
      -- when Drive really has no logo; the next cron won't repeatedly re-send it.
      if v_item.status <> 'Falta material do cliente'
        or v_item.art_auto_generation_status in ('pending', 'ready') then
        update public.creative_demands d
        set status = 'Falta material do cliente',
            art_auto_generation_status = case
              when d.art_auto_generation_status in ('pending', 'ready') then 'ready'
              else d.art_auto_generation_status
            end,
            updated_at = p_now
        where d.id = v_item.id and d.due_date is null
        returning d.id, d.external_id, d.status, d.due_date, d.raw_payload
          into result_demand_id, result_external_id, result_status,
               result_due_date, result_raw_payload;

        if found then
          result_action := 'missing_material';
          return next;
        end if;
      end if;
      continue;
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
          when d.art_auto_generation_status in ('pending', 'blocked') then 'ready'
          else d.art_auto_generation_status
        end,
        art_auto_generation_finished_at = case
          when d.art_auto_generation_status in ('pending', 'blocked') then null
          else d.art_auto_generation_finished_at
        end,
        art_auto_generation_error = case
          when d.art_auto_generation_status in ('pending', 'blocked') then null
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

-- Vercel's cold start exceeded pg_net's five-second default on the first live
-- call. Give the response enough time so the scheduled request is acknowledged.
select cron.unschedule('creative-demand-auto-due-dates')
where exists (
  select 1 from cron.job where jobname = 'creative-demand-auto-due-dates'
);

select cron.schedule(
  'creative-demand-auto-due-dates',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := url_secret.decrypted_secret,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', key_secret.decrypted_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  from vault.decrypted_secrets url_secret,
       vault.decrypted_secrets key_secret
  where url_secret.name = 'creative_demand_due_url'
    and key_secret.name = 'creative_demand_due_secret';
  $$
);
