-- HighLevel OAuth credentials are encrypted by the FastTract application before
-- they are written to this table. These columns record the envelope version and
-- the time the current ciphertext was produced.
alter table public.ghl_connections
  add column if not exists credential_version smallint not null default 0,
  add column if not exists credentials_encrypted_at timestamptz;

alter table public.ghl_connections
  drop constraint if exists ghl_connections_credential_version_check;

alter table public.ghl_connections
  add constraint ghl_connections_credential_version_check
  check (credential_version in (0, 1));

alter table public.ghl_connections
  drop constraint if exists ghl_connections_nonempty_credentials_check;

alter table public.ghl_connections
  add constraint ghl_connections_nonempty_credentials_check
  check (length(access_token) > 0 and length(refresh_token) > 0);

create index if not exists ghl_connections_company_id_idx
  on public.ghl_connections (company_id);

create index if not exists ghl_connections_company_location_idx
  on public.ghl_connections (company_id, location_id);

alter table public.ghl_connections enable row level security;
revoke all on table public.ghl_connections from anon, authenticated;

comment on column public.ghl_connections.access_token is
  'AES-256-GCM ciphertext envelope. Never expose through browser clients.';
comment on column public.ghl_connections.refresh_token is
  'AES-256-GCM ciphertext envelope. Never expose through browser clients.';
comment on column public.ghl_connections.credential_version is
  '0 means legacy plaintext pending backfill; 1 means ft-ghl:v1 AES-256-GCM envelope.';
comment on column public.ghl_connections.credentials_encrypted_at is
  'Timestamp when access_token and refresh_token were most recently encrypted.';
