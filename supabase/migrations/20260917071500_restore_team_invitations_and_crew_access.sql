create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'worker' check (role in ('owner','admin','worker')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  token_hash text,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists invitations_token_hash_key
  on public.invitations (token_hash)
  where token_hash is not null;
create index if not exists invitations_org_created_idx
  on public.invitations (organization_id, created_at desc);
create index if not exists invitations_email_status_idx
  on public.invitations (lower(email), status);

alter table public.invitations enable row level security;

drop policy if exists "Org admins can view invitations" on public.invitations;
create policy "Org admins can view invitations"
on public.invitations
for select
to authenticated
using (public.is_org_admin((select auth.uid()), organization_id));

drop policy if exists "Org admins can create invitations" on public.invitations;
create policy "Org admins can create invitations"
on public.invitations
for insert
to authenticated
with check (
  public.is_org_admin((select auth.uid()), organization_id)
  and (invited_by is null or invited_by = (select auth.uid()))
);

drop policy if exists "Org admins can update invitations" on public.invitations;
create policy "Org admins can update invitations"
on public.invitations
for update
to authenticated
using (public.is_org_admin((select auth.uid()), organization_id))
with check (public.is_org_admin((select auth.uid()), organization_id));

drop policy if exists "Org admins can delete invitations" on public.invitations;
create policy "Org admins can delete invitations"
on public.invitations
for delete
to authenticated
using (public.is_org_admin((select auth.uid()), organization_id));

drop policy if exists "Members can view own membership" on public.organization_members;
drop policy if exists "Members can view org memberships" on public.organization_members;
create policy "Members can view org memberships"
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_member((select auth.uid()), organization_id)
);

drop policy if exists "Owners can update own membership" on public.organization_members;
drop policy if exists "Org admins can update memberships" on public.organization_members;
create policy "Org admins can update memberships"
on public.organization_members
for update
to authenticated
using (public.is_org_admin((select auth.uid()), organization_id))
with check (public.is_org_admin((select auth.uid()), organization_id));

create or replace function public.get_org_hourly_rates(_org_id uuid)
returns table(user_id uuid, hourly_rate numeric)
language sql
stable
security definer
set search_path = public
as $$
  select om.user_id, om.hourly_rate
  from public.organization_members om
  where om.organization_id = _org_id
    and public.is_org_admin((select auth.uid()), _org_id);
$$;

revoke all on function public.get_org_hourly_rates(uuid) from public, anon;
grant execute on function public.get_org_hourly_rates(uuid) to authenticated;

create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_hash text;
  v_invitation public.invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_email
  from auth.users
  where id = v_user_id;

  if v_email is null then
    raise exception 'Authenticated user has no email';
  end if;

  v_hash := encode(digest(invite_token, 'sha256'), 'hex');

  select * into v_invitation
  from public.invitations
  where token_hash = v_hash
    and status = 'pending'
    and lower(email) = v_email
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, or belongs to another email';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invitation.organization_id, v_user_id, v_invitation.role)
  on conflict (organization_id, user_id)
  do update set role = excluded.role;

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
