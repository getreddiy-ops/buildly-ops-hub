-- Invoice items are reusable selling prices, separate from material purchasing costs.
create table public.invoice_item_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (length(trim(category)) > 0),
  description text not null check (length(trim(description)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  quantity numeric not null default 1 check (quantity >= 0 and quantity < 'Infinity'::numeric),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0 and unit_price < 'Infinity'::numeric),
  created_at timestamptz not null default now(),
  unique (organization_id, category, description, unit)
);
alter table public.invoice_item_catalog enable row level security;
revoke all on public.invoice_item_catalog from anon, authenticated;
grant select, insert, update, delete on public.invoice_item_catalog to authenticated;
grant all on public.invoice_item_catalog to service_role;
create policy invoice_catalog_office_access on public.invoice_item_catalog
  for all to authenticated
  using (public.is_org_admin((select auth.uid()), organization_id))
  with check (public.is_org_admin((select auth.uid()), organization_id));

alter table public.org_invoice_line_items
  add column category text not null default 'Other',
  add column unit text not null default 'ea';
