-- Payment/sync state mirrored from the GHL invoice linked via ghl_invoice_id
-- (added in 20260916050000). Populated by the Get Invoice sync path and by
-- the InvoicePaid webhook -- never by guessed fields.
alter table public.invoices
  add column if not exists ghl_invoice_status text,
  add column if not exists ghl_invoice_url text,
  add column if not exists ghl_sent_at timestamptz,
  add column if not exists ghl_paid_at timestamptz,
  add column if not exists ghl_last_synced_at timestamptz;

alter table public.estimates
  add column if not exists ghl_invoice_status text,
  add column if not exists ghl_invoice_url text,
  add column if not exists ghl_sent_at timestamptz,
  add column if not exists ghl_paid_at timestamptz,
  add column if not exists ghl_last_synced_at timestamptz;
