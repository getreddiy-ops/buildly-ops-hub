drop policy if exists "Owners can update organizations" on public.organizations;
drop policy if exists "Org admins can update organizations" on public.organizations;
create policy "Org admins can update organizations"
on public.organizations
for update
to authenticated
using (public.is_org_admin((select auth.uid()), id))
with check (public.is_org_admin((select auth.uid()), id));
