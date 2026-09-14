-- Assinaturas de hospedagem dos clientes, recebidas via webhook da Hubla

create table public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'hubla',
  external_id text not null,
  client_id uuid references public.clients (id) on delete set null,
  client_not_found boolean not null default false,
  buyer_name text not null default '',
  buyer_email text not null default '',
  product_name text,
  -- Status normalizado internamente (derivado de hubla_status + auto_renew +
  -- last_invoice_status). Ver lib/subscriptions/status.ts.
  status text not null default 'active' check (status in ('active', 'payment_issue', 'canceled')),
  hubla_status text,
  auto_renew boolean not null default true,
  payment_method text,
  billing_cycle_months integer not null default 1,
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  salesperson text check (salesperson is null or salesperson in ('matheus', 'paulo_junior')),
  activated_at timestamptz,
  canceled_at timestamptz,
  last_invoice_status text,
  last_invoice_due_date timestamptz,
  last_event_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index client_subscriptions_client_id_idx on public.client_subscriptions (client_id);
create index client_subscriptions_client_not_found_idx on public.client_subscriptions (client_not_found);
create index client_subscriptions_status_idx on public.client_subscriptions (status);
create index client_subscriptions_created_at_idx on public.client_subscriptions (created_at desc);

create trigger client_subscriptions_updated_at
  before update on public.client_subscriptions
  for each row execute function public.handle_updated_at();

alter table public.client_subscriptions enable row level security;

create policy "Authenticated users can view subscriptions"
  on public.client_subscriptions for select
  to authenticated
  using (true);

create policy "Authenticated users can update subscriptions"
  on public.client_subscriptions for update
  to authenticated
  using (true)
  with check (true);

-- Faturas pagas, uma linha por invoice.id da Hubla — dá o valor já pago (LTV)
-- por soma, em vez de um contador que poderia dobrar em reentregas de webhook.
create table public.client_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.client_subscriptions (id) on delete cascade,
  invoice_external_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'BRL',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index client_subscription_payments_subscription_id_idx
  on public.client_subscription_payments (subscription_id);

alter table public.client_subscription_payments enable row level security;

create policy "Authenticated users can view subscription payments"
  on public.client_subscription_payments for select
  to authenticated
  using (true);
