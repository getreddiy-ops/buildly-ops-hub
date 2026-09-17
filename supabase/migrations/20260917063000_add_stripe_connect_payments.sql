alter table public.organizations
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_connect_status text not null default 'not_connected',
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false;

create unique index if not exists organizations_stripe_connected_account_id_key
  on public.organizations(stripe_connected_account_id)
  where stripe_connected_account_id is not null;

alter table public.estimates
  add column if not exists deposit_checkout_session_id text,
  add column if not exists deposit_payment_intent_id text,
  add column if not exists deposit_amount_collected numeric(12,2);

create unique index if not exists estimates_deposit_checkout_session_id_key
  on public.estimates(deposit_checkout_session_id)
  where deposit_checkout_session_id is not null;
