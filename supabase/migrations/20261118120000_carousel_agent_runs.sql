-- Agente de Carrossel: o agente (OpenBot) pede um carrossel por API, o
-- CreativeOS gera os cards 100% em imagem (GPT Image), com legenda e hashtags,
-- e o carrossel fica esperando aprovação na aba "Agente de Carrossel".
--
-- Nada vai ao Instagram sem aprovação: a linha em `instagram_posts` só nasce
-- quando alguém aprova (status 'approved'); daí em diante o fluxo de
-- publicação/agendamento que já existe cuida do resto.

create table if not exists public.carousel_agent_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.carousel_profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  -- Snapshot do perfil (nome, @, logo) no momento do pedido.
  profile_name text not null default '',
  ig_user_id text not null,
  ig_username text,
  -- "ai": a IA escreve a partir do tema. "manual": o agente já mandou o texto.
  mode text not null default 'ai',
  input text not null,
  card_count int,
  -- Quando o agente quer o post no ar. null = decidir na aprovação.
  scheduled_at timestamptz,
  status text not null default 'queued',
  -- { title, styleGuide, cards: [{ texts, cta, visual }], caption, hashtags }
  plan jsonb,
  -- [{ index, url, path, prompt, status, attempts, qa: { ok, issues }, error }]
  cards jsonb not null default '[]'::jsonb,
  caption text not null default '',
  error text,
  -- Motivo da reprovação (vai de volta ao agente no callback).
  feedback text,
  instagram_post_id uuid references public.instagram_posts(id) on delete set null,
  -- Cada geração tem um id; uma geração nova faz a antiga parar de escrever.
  generation_id uuid,
  generation_started_at timestamptz,
  -- Id do lado do agente e URL para avisar mudanças de status (opcionais).
  external_ref text,
  callback_url text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.carousel_agent_runs
  drop constraint if exists carousel_agent_runs_status_check;
alter table public.carousel_agent_runs
  add constraint carousel_agent_runs_status_check
    check (status in ('queued', 'generating', 'awaiting_approval', 'approved', 'rejected', 'failed'));

alter table public.carousel_agent_runs
  drop constraint if exists carousel_agent_runs_mode_check;
alter table public.carousel_agent_runs
  add constraint carousel_agent_runs_mode_check check (mode in ('ai', 'manual'));

create index if not exists carousel_agent_runs_created_idx
  on public.carousel_agent_runs (created_at desc);
create index if not exists carousel_agent_runs_status_idx
  on public.carousel_agent_runs (status, created_at desc);

drop trigger if exists carousel_agent_runs_updated_at on public.carousel_agent_runs;
create trigger carousel_agent_runs_updated_at
  before update on public.carousel_agent_runs
  for each row execute function public.handle_updated_at();

-- Mesmo modelo de instagram_posts: o time enxerga, só o servidor escreve.
alter table public.carousel_agent_runs enable row level security;

drop policy if exists "Authenticated users can view carousel agent runs" on public.carousel_agent_runs;
create policy "Authenticated users can view carousel agent runs"
  on public.carousel_agent_runs for select to authenticated using (true);

-- Realtime: a aba acompanha a geração card a card.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'carousel_agent_runs'
  ) then
    alter publication supabase_realtime add table public.carousel_agent_runs;
  end if;
end $$;

-- ─── Cron do Instagram ───────────────────────────────────────────────────────
-- Publica os posts agendados vencidos (/api/cron/instagram-publish). Mesmo
-- esquema do prazo automático: URL e segredo ficam no Vault, porque o Supabase
-- não deixa gravar parâmetros próprios com `alter database ... set`.
--
-- select vault.create_secret('https://SEU-APP/api/cron/instagram-publish', 'instagram_publish_url');
-- select vault.create_secret('mesmo valor de INSTAGRAM_CRON_SECRET', 'instagram_publish_secret');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'instagram-publish') then
    perform cron.unschedule('instagram-publish');
  end if;
end $$;

select cron.schedule(
  'instagram-publish',
  '*/5 * * * *',
  $cron$
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
  where url_secret.name = 'instagram_publish_url'
    and key_secret.name = 'instagram_publish_secret';
  $cron$
);
