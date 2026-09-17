-- FastTract standalone onboarding bootstrap.
-- New organizations created from the browser omit created_by today, while
-- RLS requires created_by = auth.uid(). Default it from the authenticated
-- user so onboarding can create the org, read the returned row, and then add
-- the owner membership without a service-role bridge.

alter table public.organizations
  add column if not exists business_profile jsonb not null default '{}'::jsonb;

alter table public.organizations
  alter column created_by set default auth.uid();

update public.organizations
set created_by = owner_id
where created_by is null
  and owner_id is not null;

drop policy if exists "Members can view organizations" on public.organizations;
drop policy if exists "Members or creators can view organizations" on public.organizations;

create policy "Members or creators can view organizations"
on public.organizations
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    created_by = (select auth.uid())
    or owner_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can create organizations" on public.organizations;

create policy "Users can create organizations"
on public.organizations
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (
    created_by = (select auth.uid())
    or owner_id = (select auth.uid())
  )
);
