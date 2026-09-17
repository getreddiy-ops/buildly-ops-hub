create table if not exists public.fasttract_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'API key',
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['read','write']::text[],
  created_by uuid references auth.users(id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fasttract_api_keys_org_created_idx
  on public.fasttract_api_keys (organization_id, created_at desc);

create index if not exists fasttract_api_keys_active_hash_idx
  on public.fasttract_api_keys (key_hash)
  where revoked_at is null;

alter table public.fasttract_api_keys enable row level security;

comment on table public.fasttract_api_keys is
  'Hashed organization-scoped API credentials for FastTract external integrations.';
