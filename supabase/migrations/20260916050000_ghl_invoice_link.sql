-- Links a FastTract invoice (or an estimate's deposit) to the GHL invoice
-- that actually collects the payment via GHL's connected Stripe account.
-- Outbound invoice creation isn't wired up yet (pending the exact
-- create-invoice payload shape), but the inbound InvoicePaid webhook can
-- already update status/amount_paid once that linkage exists.
alter table public.invoices
  add column if not exists ghl_invoice_id text;

alter table public.estimates
  add column if not exists ghl_invoice_id text;

create unique index if not exists invoices_ghl_invoice_id_idx
  on public.invoices (ghl_invoice_id) where ghl_invoice_id is not null;

create unique index if not exists estimates_ghl_invoice_id_idx
  on public.estimates (ghl_invoice_id) where ghl_invoice_id is not null;
