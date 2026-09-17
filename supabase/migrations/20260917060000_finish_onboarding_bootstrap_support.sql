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

drop policy if exists "Members or creators can view organizations" on public.organizations;
drop policy if exists "Members creators or owners can view organizations" on public.organizations;
create policy "Members creators or owners can view organizations"
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

alter table public.organizations
  add column if not exists business_profile jsonb not null default '{}'::jsonb;

create table if not exists public.ai_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_key text not null,
  content text not null,
  source text not null default 'manual',
  approved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source, knowledge_key)
);

alter table public.ai_knowledge_entries enable row level security;

drop policy if exists "Members can read ai knowledge" on public.ai_knowledge_entries;
create policy "Members can read ai knowledge"
on public.ai_knowledge_entries
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = ai_knowledge_entries.organization_id
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Members can create ai knowledge" on public.ai_knowledge_entries;
create policy "Members can create ai knowledge"
on public.ai_knowledge_entries
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = ai_knowledge_entries.organization_id
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Members can update ai knowledge" on public.ai_knowledge_entries;
create policy "Members can update ai knowledge"
on public.ai_knowledge_entries
for update
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = ai_knowledge_entries.organization_id
      and om.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = ai_knowledge_entries.organization_id
      and om.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Members can upload branding" on storage.objects;
create policy "Members can upload branding"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'branding'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Members can update branding" on storage.objects;
create policy "Members can update branding"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'branding'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'branding'
  and exists (
    select 1 from public.organization_members om
    where om.organization_id::text = (storage.foldername(name))[1]
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Public can view branding" on storage.objects;
create policy "Public can view branding"
on storage.objects
for select
to public
using (bucket_id = 'branding');
