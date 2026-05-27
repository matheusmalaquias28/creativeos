-- Creative OS — initial schema
-- Run via Supabase CLI or SQL editor

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.client_status as enum (
  'draft',
  'onboarding',
  'active',
  'archived'
);

create type public.creative_brain_status as enum (
  'generating',
  'draft',
  'approved',
  'archived'
);

-- Users (profiles linked to auth.users)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  slug text not null,
  status public.client_status not null default 'draft',
  company_info jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

-- Visual references
create table public.client_references (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Onboarding answers
create table public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creative Brain (Brand DNA as JSONB)
create table public.creative_brains (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  brand_dna jsonb not null default '{}'::jsonb,
  version int not null default 1,
  status public.creative_brain_status not null default 'draft',
  generated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index clients_user_id_idx on public.clients (user_id);
create index clients_status_idx on public.clients (status);
create index client_references_client_id_idx on public.client_references (client_id);
create index creative_brains_client_id_idx on public.creative_brains (client_id);
create index creative_brains_status_idx on public.creative_brains (status);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();

create trigger onboarding_answers_updated_at
  before update on public.onboarding_answers
  for each row execute function public.handle_updated_at();

create trigger creative_brains_updated_at
  before update on public.creative_brains
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.client_references enable row level security;
alter table public.onboarding_answers enable row level security;
alter table public.creative_brains enable row level security;

-- Users policies
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Clients policies
create policy "Users can view own clients"
  on public.clients for select
  using (auth.uid() = user_id);

create policy "Users can insert own clients"
  on public.clients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own clients"
  on public.clients for update
  using (auth.uid() = user_id);

create policy "Users can delete own clients"
  on public.clients for delete
  using (auth.uid() = user_id);

-- Client references policies (via client ownership)
create policy "Users can view references of own clients"
  on public.client_references for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert references for own clients"
  on public.client_references for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can update references of own clients"
  on public.client_references for update
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete references of own clients"
  on public.client_references for delete
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

-- Onboarding answers policies
create policy "Users can view onboarding of own clients"
  on public.onboarding_answers for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert onboarding for own clients"
  on public.onboarding_answers for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can update onboarding of own clients"
  on public.onboarding_answers for update
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

-- Creative brains policies
create policy "Users can view creative brains of own clients"
  on public.creative_brains for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert creative brains for own clients"
  on public.creative_brains for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "Users can update creative brains of own clients"
  on public.creative_brains for update
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_id and c.user_id = auth.uid()
    )
  );

-- Storage bucket for visual references
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-references',
  'client-references',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies: path format {user_id}/{client_id}/{filename}
create policy "Users can upload references to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own reference files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own reference files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read for client references"
  on storage.objects for select
  to public
  using (bucket_id = 'client-references');

create policy "Users can delete own reference files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
