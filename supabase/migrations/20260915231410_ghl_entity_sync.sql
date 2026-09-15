-- Links GHL contacts/appointments to FastTract records and lets an org pick
-- which GHL calendar outbound job sync should write appointments to.

alter table public.ghl_connections
  add column if not exists default_calendar_id text;

alter table public.leads
  add column if not exists ghl_contact_id text;

alter table public.customers
  add column if not exists ghl_contact_id text;

alter table public.jobs
  add column if not exists ghl_appointment_id text;

-- Partial unique indexes so onConflict upserts from the webhook processor
-- can target (organization_id, ghl_*_id) without colliding on NULLs.
create unique index if not exists leads_org_ghl_contact_id_idx
  on public.leads (organization_id, ghl_contact_id)
  where ghl_contact_id is not null;

create unique index if not exists customers_org_ghl_contact_id_idx
  on public.customers (organization_id, ghl_contact_id)
  where ghl_contact_id is not null;

create unique index if not exists jobs_org_ghl_appointment_id_idx
  on public.jobs (organization_id, ghl_appointment_id)
  where ghl_appointment_id is not null;

create index if not exists ghl_connections_company_id_idx
  on public.ghl_connections (company_id);
