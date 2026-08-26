create table if not exists public.ghl_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  connection_key text not null unique,
  company_id text,
  location_id text,
  ghl_user_id text,
  user_type text not null,
  access_token text not null,
  refresh_token text not null,
  refresh_token_id text,
  token_type text not null default 'Bearer',
  scope text not null default '',
  expires_at timestamptz not null,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ghl_connections_resource_check
    check (company_id is not null or location_id is not null)
);

alter table public.ghl_connections enable row level security;

-- OAuth credentials are backend-only. The service role used by Edge Functions
-- bypasses RLS; browser clients receive no direct table access.
revoke all on table public.ghl_connections from anon, authenticated;

create index if not exists ghl_connections_organization_id_idx
  on public.ghl_connections (organization_id);

create index if not exists ghl_connections_location_id_idx
  on public.ghl_connections (location_id);
