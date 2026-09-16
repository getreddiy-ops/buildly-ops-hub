-- Customer-facing estimate acceptance: a share token lets a customer view
-- and accept/e-sign an estimate without a FastTract login, and a
-- deposit_required amount lets a contractor state what's owed up front.
-- Access for the anon customer link is entirely through the
-- public-estimate edge function (service role), never a direct table grant,
-- so this stays safe to add without touching estimates' existing RLS.
alter table public.estimates
  add column if not exists share_token text unique default encode(gen_random_bytes(24), 'hex'),
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_name text,
  add column if not exists signature_text text,
  add column if not exists deposit_required numeric(12,2),
  add column if not exists deposit_collected boolean not null default false,
  add column if not exists deposit_collected_at timestamptz;

-- Backfill tokens for any estimates created before this migration.
update public.estimates set share_token = encode(gen_random_bytes(24), 'hex') where share_token is null;

create index if not exists estimates_share_token_idx on public.estimates (share_token);
