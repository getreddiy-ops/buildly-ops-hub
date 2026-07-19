-- Make subscription entitlements payment-provider neutral while preserving
-- existing Paddle rows and internal comp subscriptions.
alter table public.subscriptions
  alter column paddle_subscription_id drop not null,
  alter column paddle_customer_id drop not null;

alter table public.subscriptions
  add column if not exists billing_provider text not null default 'paddle',
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text;

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_provider_check;

alter table public.subscriptions
  add constraint subscriptions_billing_provider_check
  check (billing_provider in ('paddle', 'stripe', 'internal'));

create unique index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions(stripe_subscription_id);

create index if not exists idx_subscriptions_stripe_customer_id
  on public.subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

-- Billing identifiers are server-only. Replace the legacy table-wide grant
-- with an explicit entitlement-only column grant; RLS still limits rows.
revoke select on public.subscriptions from anon, authenticated;
grant select (
  id,
  user_id,
  organization_id,
  product_id,
  price_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  environment,
  billing_provider,
  created_at,
  updated_at
) on public.subscriptions to authenticated;
