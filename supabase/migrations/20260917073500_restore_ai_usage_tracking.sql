create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = 'platform_admin'
  );
$$;

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  function_name text not null,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  status text not null default 'success',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_org_created_idx
  on public.ai_usage (organization_id, created_at desc);
create index if not exists ai_usage_created_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "Platform admins can view AI usage" on public.ai_usage;
create policy "Platform admins can view AI usage"
on public.ai_usage
for select
to authenticated
using (public.is_platform_admin((select auth.uid())));

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;
