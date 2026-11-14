-- FastTract subscriptions move from Paddle to Stripe (launch plan Phase 4).
-- Makes subscription rows provider-neutral, keeps any historic Paddle rows readable,
-- and gives complimentary (admin-granted) plans their own key instead of a fake
-- Paddle id.

alter table public.subscriptions
  alter column paddle_subscription_id drop not null,
  alter column paddle_customer_id drop not null;

alter table public.subscriptions
  add column if not exists billing_provider text not null default 'paddle',
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists comp_reference text;

alter table public.subscriptions drop constraint if exists subscriptions_billing_provider_check;
alter table public.subscriptions
  add constraint subscriptions_billing_provider_check
  check (billing_provider in ('paddle', 'stripe', 'internal'));

-- Existing complimentary plans were stored under a fake Paddle id "comp_<org>_<env>".
update public.subscriptions
   set billing_provider = 'internal',
       comp_reference = paddle_subscription_id,
       paddle_subscription_id = null,
       paddle_customer_id = null
 where paddle_subscription_id like 'comp\_%';

create unique index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions (stripe_subscription_id);
create unique index if not exists idx_subscriptions_comp_reference
  on public.subscriptions (comp_reference);
create index if not exists idx_subscriptions_stripe_customer_id
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

-- Billing identifiers are server-only. Members may read the entitlement columns;
-- RLS ("Members can view organization subscriptions") still limits which rows.
revoke select on public.subscriptions from anon, authenticated;
grant select (
  id, user_id, organization_id, product_id, price_id, status,
  current_period_start, current_period_end, cancel_at_period_end,
  environment, billing_provider, created_at, updated_at
) on public.subscriptions to authenticated;
