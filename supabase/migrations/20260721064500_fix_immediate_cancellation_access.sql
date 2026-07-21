-- Scheduled cancellations stay active in Paddle until the end of the billing
-- period. Once status becomes `canceled`, cancellation is effective and access
-- must stop immediately rather than trusting the old period-end timestamp.
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function public.has_active_org_subscription(
  org_id uuid,
  check_env text default 'live'
)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where organization_id = org_id
      and environment = check_env
      and status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  );
$$;
