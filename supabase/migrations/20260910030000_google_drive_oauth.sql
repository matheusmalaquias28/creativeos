-- Conta Google da equipe para entregar artes no Meu Drive (OAuth, não service account)

create table public.google_drive_oauth_tokens (
  id int primary key default 1 check (id = 1),
  google_email text,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_oauth_tokens enable row level security;

drop trigger if exists google_drive_oauth_tokens_updated_at on public.google_drive_oauth_tokens;
create trigger google_drive_oauth_tokens_updated_at
  before update on public.google_drive_oauth_tokens
  for each row execute function public.handle_updated_at();
