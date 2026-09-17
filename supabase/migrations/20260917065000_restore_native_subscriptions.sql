create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  paddle_customer_id text not null,
  paddle_subscription_id text not null unique,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'live' check (environment in ('live','sandbox')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists subscriptions_org_environment_created_idx
  on public.subscriptions (organization_id, environment, created_at desc);
create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);

alter table public.subscriptions enable row level security;

drop policy if exists "Members can view organization subscriptions" on public.subscriptions;
create policy "Members can view organization subscriptions"
on public.subscriptions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = subscriptions.organization_id
      and om.user_id = (select auth.uid())
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'subscriptions'
     ) then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;
