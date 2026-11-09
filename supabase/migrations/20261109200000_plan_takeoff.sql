-- Plan upload and concrete takeoff (launch plan Phase 7).
-- A plan set is one uploaded PDF; each page is stored as an image in the private plan-sets bucket
-- under <organization_id>/<plan_set_id>/page-<n>.jpg. The AI's reading goes in takeoff_draft; nothing
-- reaches an estimate until a person confirms it into takeoff_confirmed.

create table if not exists public.plan_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.org_jobs(id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  status text not null default 'uploaded' check (status in ('uploaded', 'reading', 'review', 'confirmed', 'failed')),
  page_count int not null default 0 check (page_count between 0 and 200),
  takeoff_draft jsonb,
  takeoff_confirmed jsonb,
  settings jsonb not null default '{}'::jsonb,
  last_error text,
  estimate_id uuid references public.estimates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plan_sets_org on public.plan_sets (organization_id, created_at desc);
create index if not exists idx_plan_sets_job on public.plan_sets (job_id);

create table if not exists public.plan_sheets (
  id uuid primary key default gen_random_uuid(),
  plan_set_id uuid not null references public.plan_sets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_number int not null check (page_number >= 1),
  storage_path text not null,
  width_px int not null,
  height_px int not null,
  kind text not null default 'unsorted' check (kind in ('unsorted', 'foundation', 'details', 'notes', 'other')),
  sheet_label text,
  include_in_reading boolean not null default true,
  -- Scale set by the user clicking both ends of a known dimension: pixels per foot.
  scale_px_per_ft numeric check (scale_px_per_ft is null or scale_px_per_ft > 0),
  -- Traced form runs, bolt marks and pour breaks drawn on this sheet (Phase 7.5).
  markup jsonb not null default '[]'::jsonb,
  unique (plan_set_id, page_number)
);
create index if not exists idx_plan_sheets_set on public.plan_sheets (plan_set_id, page_number);

alter table public.plan_sets enable row level security;
alter table public.plan_sheets enable row level security;

-- Office roles (owner/admin) and anyone in the business can read; any member may upload and edit
-- takeoffs for their own business. Crew get read access through membership.
drop policy if exists "Members read plan sets" on public.plan_sets;
create policy "Members read plan sets" on public.plan_sets for select to authenticated
  using (public.is_org_member((select auth.uid()), organization_id));
drop policy if exists "Members write plan sets" on public.plan_sets;
create policy "Members write plan sets" on public.plan_sets for all to authenticated
  using (public.is_org_member((select auth.uid()), organization_id))
  with check (public.is_org_member((select auth.uid()), organization_id));

drop policy if exists "Members read plan sheets" on public.plan_sheets;
create policy "Members read plan sheets" on public.plan_sheets for select to authenticated
  using (public.is_org_member((select auth.uid()), organization_id));
drop policy if exists "Members write plan sheets" on public.plan_sheets;
create policy "Members write plan sheets" on public.plan_sheets for all to authenticated
  using (public.is_org_member((select auth.uid()), organization_id))
  with check (
    public.is_org_member((select auth.uid()), organization_id)
    and exists (select 1 from public.plan_sets ps where ps.id = plan_set_id and ps.organization_id = plan_sheets.organization_id)
  );

grant select, insert, update, delete on public.plan_sets, public.plan_sheets to authenticated;

-- ---------- Storage: private bucket, one folder per business ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plan-sets', 'plan-sets', false, 15728640, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "Members read their plan images" on storage.objects;
create policy "Members read their plan images" on storage.objects for select to authenticated
  using (bucket_id = 'plan-sets' and public.is_org_member((select auth.uid()), ((storage.foldername(name))[1])::uuid));
drop policy if exists "Members upload their plan images" on storage.objects;
create policy "Members upload their plan images" on storage.objects for insert to authenticated
  with check (bucket_id = 'plan-sets' and public.is_org_member((select auth.uid()), ((storage.foldername(name))[1])::uuid));
drop policy if exists "Members delete their plan images" on storage.objects;
create policy "Members delete their plan images" on storage.objects for delete to authenticated
  using (bucket_id = 'plan-sets' and public.is_org_member((select auth.uid()), ((storage.foldername(name))[1])::uuid));
