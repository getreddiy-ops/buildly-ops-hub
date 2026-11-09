alter table public.contractor_time_entries
  add column entry_source text not null default 'clock' check (entry_source in ('clock','manual')),
  add column entered_by uuid references auth.users(id) on delete set null;
create index contractor_time_entries_entered_by_idx on public.contractor_time_entries(entered_by) where entered_by is not null;

-- Manual entry is an office action. Existing field clock insert behavior stays
-- user-scoped; clients cannot claim that a field clock was entered by an admin.
drop policy "contractor time own insert" on public.contractor_time_entries;
create policy "contractor time own insert" on public.contractor_time_entries
  for insert to authenticated with check (
    entry_source='clock' and entered_by is null
    and user_id=(select auth.uid()) and public.is_org_member((select auth.uid()),organization_id)
  );
create policy "contractor time manual insert" on public.contractor_time_entries
  for insert to authenticated with check (
    entry_source='manual' and entered_by=(select auth.uid())
    and public.is_org_admin((select auth.uid()),organization_id)
    and exists(select 1 from public.organization_members m where m.user_id=contractor_time_entries.user_id and m.organization_id=contractor_time_entries.organization_id)
    and clock_out is not null and clock_out>clock_in and clock_out<=now()
    and exists(select 1 from public.org_jobs j where j.organization_id=contractor_time_entries.organization_id and j.id::text=contractor_time_entries.job_id)
  );
drop policy "contractor time own update" on public.contractor_time_entries;
create policy "contractor time own update" on public.contractor_time_entries
  for update to authenticated using (
    (user_id=(select auth.uid()) and status='pending' and entry_source='clock')
    or public.is_org_admin((select auth.uid()),organization_id)
  ) with check (
    (user_id=(select auth.uid()) and entry_source='clock' and public.is_org_member((select auth.uid()),organization_id))
    or public.is_org_admin((select auth.uid()),organization_id)
  );

create function public.validate_manual_job_time() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    -- Allow the FK's ON DELETE SET NULL when an entering user's account is
    -- removed; all client attempts to rewrite audit attribution are blocked.
    if new.entry_source is distinct from old.entry_source
       or (new.entered_by is distinct from old.entered_by and not (new.entered_by is null and pg_trigger_depth()>1)) then
      raise exception 'Entry source and recorder cannot be changed';
    end if;
  end if;
  if new.entry_source='manual' then
    if not isfinite(new.clock_in) or new.clock_out is null or not isfinite(new.clock_out)
      or new.clock_out<=new.clock_in or new.clock_out>now() then
      raise exception 'Manual entries need a valid start and end time in the past';
    end if;
    if not exists(select 1 from public.organization_members m where m.user_id=new.user_id and m.organization_id=new.organization_id) then raise exception 'Worker must belong to this company'; end if;
    if not exists(select 1 from public.org_jobs j where j.id::text=new.job_id and j.organization_id=new.organization_id) then raise exception 'Job must belong to this company'; end if;
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || ':' || new.user_id::text,0));
    if new.status<>'rejected' and exists (
      select 1 from public.contractor_time_entries e
      where e.organization_id=new.organization_id and e.user_id=new.user_id and e.id<>new.id and e.status<>'rejected'
        and tstzrange(e.clock_in,e.clock_out,'[)') && tstzrange(new.clock_in,new.clock_out,'[)')
    ) then raise exception 'This worker already has time recorded during that period'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_manual_job_time() from public,anon,authenticated;
create trigger validate_manual_job_time before insert or update on public.contractor_time_entries
  for each row execute function public.validate_manual_job_time();

create function public.record_manual_job_time(
  p_entry_id uuid,p_organization_id uuid,p_user_id uuid,p_job_id uuid,
  p_clock_in timestamptz,p_clock_out timestamptz,p_note text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_existing public.contractor_time_entries%rowtype; v_title text; v_note text:=nullif(btrim(p_note),'');
begin
  if auth.uid() is null or not public.is_org_admin(auth.uid(),p_organization_id) then raise exception 'Only company owners and admins can add past time'; end if;
  if p_entry_id is null or p_user_id is null or p_job_id is null then raise exception 'Choose a worker and job'; end if;
  if length(v_note)>2000 then raise exception 'Note must be 2000 characters or fewer'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_user_id::text,0));
  select * into v_existing from public.contractor_time_entries where id=p_entry_id;
  if found then
    if v_existing.entry_source='manual' and v_existing.entered_by=auth.uid()
      and v_existing.organization_id=p_organization_id and v_existing.user_id=p_user_id
      and v_existing.job_id=p_job_id::text and v_existing.clock_in=p_clock_in and v_existing.clock_out=p_clock_out
      and v_existing.note is not distinct from v_note then return v_existing.id; end if;
    raise exception 'This entry reference was already used; reopen the form';
  end if;
  select title into v_title from public.org_jobs where id=p_job_id and organization_id=p_organization_id;
  if not found then raise exception 'Job must belong to this company'; end if;
  insert into public.contractor_time_entries(id,organization_id,user_id,job_id,job_title,clock_in,clock_out,note,entry_source,entered_by,status)
    values(p_entry_id,p_organization_id,p_user_id,p_job_id::text,v_title,p_clock_in,p_clock_out,v_note,'manual',auth.uid(),'pending');
  return p_entry_id;
end;
$$;
revoke all on function public.record_manual_job_time(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.record_manual_job_time(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text) to authenticated;
