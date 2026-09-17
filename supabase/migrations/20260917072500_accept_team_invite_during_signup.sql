create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite_hash text := nullif(new.raw_user_meta_data->>'invite_token_hash', '');
  v_invitation public.invitations%rowtype;
  v_full_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), '');
begin
  insert into public.profiles (id, email, name, full_name)
  values (new.id, new.email, v_full_name, v_full_name)
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when coalesce(public.profiles.full_name, '') = '' then excluded.full_name else public.profiles.full_name end,
        name = case when coalesce(public.profiles.name, '') = '' then excluded.name else public.profiles.name end;

  if v_invite_hash is not null and new.email is not null then
    select * into v_invitation
    from public.invitations
    where token_hash = v_invite_hash
      and status = 'pending'
      and lower(email) = lower(new.email)
    order by created_at desc
    limit 1
    for update;

    if found then
      insert into public.organization_members (organization_id, user_id, role)
      values (v_invitation.organization_id, new.id, v_invitation.role)
      on conflict (organization_id, user_id)
      do update set role = excluded.role;

      update public.invitations
      set status = 'accepted', accepted_at = now()
      where id = v_invitation.id;
    end if;
  end if;

  return new;
end;
$$;
