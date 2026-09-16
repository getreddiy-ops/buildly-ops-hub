-- Production-readiness audit fixes:
-- 1. time_off_requests: a worker could set their own pending request to
--    'approved' because the UPDATE policy's WITH CHECK didn't restrict
--    status the way USING did. Close the self-approval hole.
-- 2. ai_knowledge_entries: the "approved" read policy never actually
--    filtered on the approved column, so unapproved AI-drafted knowledge
--    was visible org-wide.
-- 3. highlevel_events: explicit revoke for clarity (already default-deny
--    via RLS-with-no-policies, but matches the ghl_connections pattern).
-- 4. phone_assistants.twilio_phone_number: no uniqueness meant two orgs
--    could claim the same BYO number, colliding on inbound-call routing.

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'time_off_requests' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.time_off_requests', pol.policyname);
  end loop;
end $$;

-- Preserves the original intent (a worker can edit or self-cancel their own
-- pending/approved request; an admin can update any request in their org)
-- while closing the hole: a worker's own edit can only land on 'pending' or
-- 'cancelled' — never 'approved' or 'denied', which stay admin-only.
create policy "time_off self update pending or approved" on public.time_off_requests
  for update to authenticated
  using (user_id = auth.uid() and status in ('pending', 'approved'))
  with check (user_id = auth.uid() and status in ('pending', 'cancelled'));

create policy "time_off admin update any" on public.time_off_requests
  for update to authenticated
  using (public.is_org_admin(auth.uid(), organization_id))
  with check (public.is_org_admin(auth.uid(), organization_id));

drop policy if exists "Organization members can read approved AI knowledge" on public.ai_knowledge_entries;
create policy "Organization members can read approved AI knowledge" on public.ai_knowledge_entries
  for select to authenticated
  using (public.is_org_member(auth.uid(), organization_id) and approved = true);

revoke all on table public.highlevel_events from anon, authenticated;

alter table public.phone_assistants
  add constraint phone_assistants_twilio_phone_number_key unique (twilio_phone_number);
