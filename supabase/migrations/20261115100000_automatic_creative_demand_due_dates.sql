-- Define automaticamente o prazo das demandas de arte apos uma janela de
-- estabilizacao de 10 minutos. Reprocessamentos sao serializados.

alter table public.creative_demands
  add column if not exists art_auto_generation_status text not null default 'manual',
  add column if not exists art_auto_generation_started_at timestamptz,
  add column if not exists art_auto_generation_finished_at timestamptz,
  add column if not exists art_auto_generation_error text;

create index if not exists creative_demands_auto_due_date_idx
  on public.creative_demands (updated_at, external_created_at, created_at)
  where is_archived = false and due_date is null;

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
  -- Serialize runs so concurrent cron calls cannot reserve the same slot.
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
    -- Se ainda falta a logo no onboarding, marca uma vez e deixa sem prazo.
    if (
      v_item.client_status = 'onboarding'
      or coalesce(
        v_item.raw_payload ->> 'categoria',
        v_item.raw_payload ->> 'category',
        v_item.raw_payload -> 'briefing' ->> 'categoria',
        ''
      ) ~* 'onboarding'
    ) and not coalesce(v_item.has_logo, false) then
      if v_item.status <> 'Falta material do cliente' then
        update public.creative_demands d
        set status = 'Falta material do cliente',
            art_auto_generation_status = case
              when d.art_auto_generation_status = 'pending' then 'ready'
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

    -- A regra de 16h usa a hora em que o gestor pediu, nao a hora do cron.
    v_requested_local := coalesce(v_item.external_created_at, v_item.created_at)
      at time zone 'America/Sao_Paulo';
    v_today_local := (p_now at time zone 'America/Sao_Paulo')::date;
    v_due_day := greatest(v_requested_local::date, v_today_local);
    if v_requested_local::time > time '16:00' then
      v_due_day := greatest(v_due_day, v_requested_local::date + 1);
    end if;

    -- Dias uteis somente; limite de cinco prazos ativos por dia, incluindo
    -- datas definidas manualmente e ajustes.
    loop
      if extract(isodow from v_due_day) between 1 and 5 then
        select count(*)::integer
          into v_daily_count
        from public.creative_demands d
        where not d.is_archived
          and d.due_date is not null
          and (d.due_date at time zone 'America/Sao_Paulo')::date = v_due_day;

        if v_daily_count < 5 then
          exit;
        end if;
      end if;
      v_due_day := v_due_day + 1;
    end loop;

    update public.creative_demands d
    set due_date = (v_due_day::timestamp + time '23:59') at time zone 'America/Sao_Paulo',
        status = case when v_item.status = 'Ajuste' then 'Ajuste' else 'Em Fila' end,
        art_auto_generation_status = case
          when d.art_auto_generation_status = 'pending' then 'ready'
          else d.art_auto_generation_status
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

revoke all on function public.assign_creative_demand_due_dates(timestamptz)
  from public, anon, authenticated;
grant execute on function public.assign_creative_demand_due_dates(timestamptz)
  to service_role;

-- O cron chama a rota a cada cinco minutos e so processa demandas estaveis
-- ha pelo menos dez minutos. O Supabase nao permite `alter database ... set`
-- para parametros proprios, entao URL e segredo ficam no Vault. Configure antes
-- de ativar (o job nao chama nada enquanto os dois segredos nao existirem):
-- select vault.create_secret('https://SEU-APP/api/cron/creative-demand-due-dates', 'creative_demand_due_url');
-- select vault.create_secret('mesmo valor de CREATIVE_DEMAND_DUE_CRON_SECRET', 'creative_demand_due_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

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
    body := '{}'::jsonb
  )
  from vault.decrypted_secrets url_secret,
       vault.decrypted_secrets key_secret
  where url_secret.name = 'creative_demand_due_url'
    and key_secret.name = 'creative_demand_due_secret';
  $$
);
