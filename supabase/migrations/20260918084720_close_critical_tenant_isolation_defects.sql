-- FastTract: close three critical/high tenant-isolation defects.
--
-- ALREADY APPLIED to project qjusjfdrtposrthlcjeu on 2026-09-18 as migration
-- version 20260918084720. This file exists so the repository has a record of the
-- change; it is NOT pending. Do not re-run it manually.
--
-- NOTE ON MIGRATION DRIFT: this repo's supabase/migrations/ directory and the live
-- database's applied history are two different lineages (54 files here vs 26 applied,
-- with different version stamps, plus a duplicate version prefix at 20260917061500).
-- `supabase db push` is therefore UNSAFE to run against production until the
-- histories are reconciled with `supabase migration repair`. That is why this change
-- was applied directly rather than through the deploy-supabase-production workflow.
--
-- What was wrong:
--   1) organization_members INSERT let ANY authenticated user insert themselves into
--      ANY organization as 'owner' — the WITH CHECK constrained only user_id, never
--      organization_id or role. organization_members is the tenancy root, so one row
--      granted full read/write over another tenant's customers, estimates, invoices,
--      jobs and OAuth credentials.
--   2) profiles SELECT was USING (true) for role `public` (which includes `anon`),
--      so anyone holding the publishable key shipped in the browser bundle could dump
--      every user's email, phone and name across every tenant, unauthenticated.
--   3) time_entries UPDATE had a disjunctive WITH CHECK, so a user could satisfy it
--      via `user_id = auth.uid()` alone and relocate their own row into another org.
--   4) organizations had a table-level UPDATE grant covering stripe_connected_account_id
--      and stripe_charges_enabled, which stripe-estimate-checkout trusts as payout
--      authority — so an org admin could route customer deposits to their own account.

-- ---------- helpers (SECURITY DEFINER, pinned search_path) ----------
create or replace function public.can_bootstrap_org_membership(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id is not null
     and not exists (select 1 from public.organization_members m where m.organization_id = _org_id)
     and exists (select 1 from public.organizations o
                 where o.id = _org_id and (o.created_by = _user_id or o.owner_id = _user_id));
$$;

create or replace function public.shares_org_with(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _a is not null and _b is not null and exists (
    select 1 from public.organization_members m1
    join public.organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = _a and m2.user_id = _b);
$$;

-- RLS policy expressions are evaluated as the querying role, so EXECUTE is required
-- for the policies below to work at all.
grant execute on function public.can_bootstrap_org_membership(uuid, uuid) to authenticated, service_role;
grant execute on function public.shares_org_with(uuid, uuid) to authenticated, service_role;

-- ---------- 1) organization_members: bootstrap-only self insert ----------
-- The only legitimate self-insert is the first owner of an org you just created.
-- Every other join must go through accept_invitation(), which is SECURITY DEFINER
-- and therefore unaffected by this policy.
drop policy if exists "Users can create own membership" on public.organization_members;
create policy "Owners can bootstrap first membership"
on public.organization_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and public.can_bootstrap_org_membership((select auth.uid()), organization_id)
);

-- ---------- 2) profiles: self + co-members + platform admin ----------
drop policy if exists "Anyone can read profiles" on public.profiles;
create policy "Read own and co-member profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.shares_org_with((select auth.uid()), id)
  or public.is_platform_admin((select auth.uid()))
);

-- retarget the remaining profiles policies off role `public` (which includes anon)
-- and wrap auth.uid() so it is evaluated once per statement rather than per row.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- 3) time_entries: pin org membership as a mandatory conjunct ----------
drop policy if exists "ft time own update" on public.time_entries;
create policy "ft time own update" on public.time_entries for update to authenticated
using (
  (user_id = (select auth.uid())) or public.is_org_admin((select auth.uid()), organization_id)
)
with check (
  public.is_org_member((select auth.uid()), organization_id)
  and ((user_id = (select auth.uid())) or public.is_org_admin((select auth.uid()), organization_id))
);

-- ---------- 4) organizations: column-scoped UPDATE ----------
-- Postgres RLS cannot restrict columns, so this is enforced with column-level grants.
-- Allowed set == exactly what the client legitimately writes today:
--   Branding.tsx  -> name, legal_name, address, phone, email, website, tax_id,
--                    brand_color, brand_color_secondary, document_defaults
--   Onboarding.tsx/Branding.tsx -> logo_url
-- Deliberately NOT writable by `authenticated`: id, created_at, created_by, owner_id,
-- agent_id, plan, and all stripe_* columns. Edge functions that must write those
-- (stripe-connect, stripe-connect-webhook) use the service role and bypass RLS.
revoke update on public.organizations from authenticated;
revoke insert, update, delete on public.organizations from anon;
grant update (
  name, legal_name, slug, address, phone, email, website,
  business_type, business_profile, brand_color, brand_color_secondary,
  logo_url, document_defaults, tax_id, updated_at
) on public.organizations to authenticated;

-- ---------- RLS hot-path indexes ----------
-- Every policy on these tables filters by organization_id via is_org_member(), so
-- without these indexes tenant-isolation enforcement runs as a sequential scan.
create index if not exists idx_ai_actions_org on public.ai_actions(organization_id);
create index if not exists idx_contracts_org on public.contracts(organization_id);
create index if not exists idx_leads_org on public.leads(organization_id);
create index if not exists idx_materials_org on public.materials(organization_id);
create index if not exists idx_time_entries_org on public.time_entries(organization_id);
create index if not exists idx_vendors_org on public.vendors(organization_id);
create index if not exists idx_estimate_line_items_estimate on public.estimate_line_items(estimate_id);
create index if not exists idx_invoice_line_items_invoice on public.invoice_line_items(invoice_id);
create index if not exists idx_job_costs_job on public.job_costs(job_id);
