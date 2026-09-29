-- Keep SECURITY DEFINER policy helpers bound to the signed-in caller.
-- These helpers are also callable through PostgREST, so never trust a caller
-- supplied user ID without comparing it to auth.uid().

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id = (select auth.uid())
     and exists (
       select 1
       from public.organization_members
       where user_id = _user_id
         and organization_id = _org_id
     );
$$;

create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id = (select auth.uid())
     and exists (
       select 1
       from public.organization_members
       where user_id = _user_id
         and organization_id = _org_id
         and role in ('owner', 'admin')
     );
$$;

create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id = (select auth.uid())
     and exists (
       select 1
       from public.user_roles
       where user_id = _user_id
         and role = 'platform_admin'
     );
$$;

create or replace function public.shares_org_with(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _a = (select auth.uid())
     and _b is not null
     and exists (
       select 1
       from public.organization_members m1
       join public.organization_members m2
         on m1.organization_id = m2.organization_id
       where m1.user_id = _a
         and m2.user_id = _b
     );
$$;

create or replace function public.can_bootstrap_org_membership(_user_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id = (select auth.uid())
     and not exists (
       select 1
       from public.organization_members m
       where m.organization_id = _org_id
     )
     and exists (
       select 1
       from public.organizations o
       where o.id = _org_id
         and (o.created_by = _user_id or o.owner_id = _user_id)
     );
$$;

-- The workspace helper resolves only the current authenticated user's
-- workspace. Anonymous callers cannot benefit from it and should not invoke
-- this SECURITY DEFINER function through the public API.
create or replace function public.current_workspace_id()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = (select auth.uid())::text
  limit 1;
$$;

revoke all on function public.current_workspace_id() from public, anon;
grant execute on function public.current_workspace_id() to authenticated, service_role;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
