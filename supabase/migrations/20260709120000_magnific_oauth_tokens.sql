-- Credenciais OAuth do MCP do Magnific (conta única compartilhada da equipe)

create table public.magnific_oauth_tokens (
  id int primary key default 1 check (id = 1),
  client_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  code_verifier text,
  state text,
  updated_at timestamptz not null default now()
);

alter table public.magnific_oauth_tokens enable row level security;
-- Sem policies: acesso apenas via service role (createAdminClient()).

create trigger magnific_oauth_tokens_updated_at
  before update on public.magnific_oauth_tokens
  for each row execute function public.handle_updated_at();
