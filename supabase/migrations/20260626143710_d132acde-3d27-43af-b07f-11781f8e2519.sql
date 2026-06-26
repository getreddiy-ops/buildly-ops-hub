-- Add organization_id (nullable initially; new rows will set it)
alter table public.subscriptions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists idx_subscriptions_org on public.subscriptions(organization_id);

-- Org-level entitlement check
create or replace function public.has_active_org_subscription(
  org_id uuid,
  check_env text default 'live'
) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where organization_id = org_id
      and environment = check_env
      and (
        (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$$;

-- Allow org members to read their org's subscription (so non-owners see Pro unlocked)
drop policy if exists "Org members can view org subscription" on public.subscriptions;
create policy "Org members can view org subscription"
  on public.subscriptions for select
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(auth.uid(), organization_id)
  );
