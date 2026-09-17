create table if not exists public.support_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_notes_org_pinned_created_idx
  on public.support_notes (organization_id, pinned desc, created_at desc);

alter table public.support_notes enable row level security;

drop policy if exists "Platform admins can manage support notes" on public.support_notes;
create policy "Platform admins can manage support notes"
on public.support_notes
for all
to authenticated
using (public.is_platform_admin((select auth.uid())))
with check (
  public.is_platform_admin((select auth.uid()))
  and author_id = (select auth.uid())
);
