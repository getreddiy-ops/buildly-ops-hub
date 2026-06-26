
-- Branding columns on organizations
alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists brand_color text,
  add column if not exists brand_color_secondary text,
  add column if not exists legal_name text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists tax_id text,
  add column if not exists document_defaults jsonb not null default '{}'::jsonb;

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  number text,
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  notes text,
  terms text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "invoices org members" on public.invoices for all
  using (public.is_org_member(auth.uid(), organization_id))
  with check (public.is_org_member(auth.uid(), organization_id));
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.update_updated_at_column();

-- Invoice line items
create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invoice_line_items to authenticated;
grant all on public.invoice_line_items to service_role;
alter table public.invoice_line_items enable row level security;
create policy "invoice items via invoice" on public.invoice_line_items for all
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_org_member(auth.uid(), i.organization_id)))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_org_member(auth.uid(), i.organization_id)));

-- Contracts
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  body text,
  sent_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contracts to authenticated;
grant all on public.contracts to service_role;
alter table public.contracts enable row level security;
create policy "contracts org members" on public.contracts for all
  using (public.is_org_member(auth.uid(), organization_id))
  with check (public.is_org_member(auth.uid(), organization_id));
create trigger contracts_updated_at before update on public.contracts
  for each row execute function public.update_updated_at_column();
