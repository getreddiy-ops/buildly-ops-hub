-- Preserve existing calendar sync and admin reporting fields on the new OS tables.
ALTER TABLE public.org_jobs
  ADD COLUMN IF NOT EXISTS ghl_appointment_id text;

ALTER TABLE public.org_invoices
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;
