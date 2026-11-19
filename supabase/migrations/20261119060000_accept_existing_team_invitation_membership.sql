-- Employee invitations can be accepted during auth.users creation, before email
-- confirmation. The join page must be able to acknowledge that completed
-- membership when the employee later follows the confirmation link.
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'Authenticated user has no email';
  end if;

  select * into v_invitation
  from public.invitations
  where token_hash = encode(digest(invite_token, 'sha256'), 'hex')
    and lower(email) = v_email
    and status in ('pending', 'accepted')
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, or belongs to another email';
  end if;

  if v_invitation.status = 'accepted' then
    -- Only consider an already-accepted invitation successful when this
    -- authenticated user is actually a member of the invited organization.
    if exists (
      select 1 from public.organization_members
      where organization_id = v_invitation.organization_id
        and user_id = v_user_id
    ) then
      return v_invitation.organization_id;
    end if;
    raise exception 'Invitation already accepted by another account';
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
