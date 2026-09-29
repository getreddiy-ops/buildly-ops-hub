-- The live FastTract database also contains legacy workspace tables named
-- jobs and invoices. Keep them intact and give the Contractor OS its own
-- organization-scoped operational tables.

CREATE TABLE IF NOT EXISTS public.org_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'scheduled',
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  budget numeric(12,2),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_jobs_org_created_idx ON public.org_jobs (organization_id, created_at DESC);
ALTER TABLE public.org_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_jobs TO authenticated;
GRANT ALL ON public.org_jobs TO service_role;
DROP POLICY IF EXISTS "org jobs member access" ON public.org_jobs;
CREATE POLICY "org jobs member access" ON public.org_jobs FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
DROP TRIGGER IF EXISTS org_jobs_updated ON public.org_jobs;
CREATE TRIGGER org_jobs_updated BEFORE UPDATE ON public.org_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.org_crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.org_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
ALTER TABLE public.org_crew_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_crew_assignments TO authenticated;
GRANT ALL ON public.org_crew_assignments TO service_role;
DROP POLICY IF EXISTS "org crew via job" ON public.org_crew_assignments;
CREATE POLICY "org crew via job" ON public.org_crew_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_jobs j WHERE j.id = job_id AND public.is_org_member(auth.uid(), j.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_jobs j WHERE j.id = job_id AND public.is_org_member(auth.uid(), j.organization_id)));

CREATE TABLE IF NOT EXISTS public.org_job_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.org_jobs(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  incurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_job_costs_job_date_idx ON public.org_job_costs (job_id, incurred_on DESC);
ALTER TABLE public.org_job_costs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_job_costs TO authenticated;
GRANT ALL ON public.org_job_costs TO service_role;
DROP POLICY IF EXISTS "org job costs via job" ON public.org_job_costs;
CREATE POLICY "org job costs via job" ON public.org_job_costs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_jobs j WHERE j.id = job_id AND public.is_org_member(auth.uid(), j.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_jobs j WHERE j.id = job_id AND public.is_org_member(auth.uid(), j.organization_id)));

CREATE TABLE IF NOT EXISTS public.org_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.org_jobs(id) ON DELETE SET NULL,
  number text,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  notes text,
  terms text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_invoices_org_created_idx ON public.org_invoices (organization_id, created_at DESC);
ALTER TABLE public.org_invoices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invoices TO authenticated;
GRANT ALL ON public.org_invoices TO service_role;
DROP POLICY IF EXISTS "org invoices member access" ON public.org_invoices;
CREATE POLICY "org invoices member access" ON public.org_invoices FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
DROP TRIGGER IF EXISTS org_invoices_updated ON public.org_invoices;
CREATE TRIGGER org_invoices_updated BEFORE UPDATE ON public.org_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.org_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.org_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_invoice_line_items_invoice_position_idx ON public.org_invoice_line_items (invoice_id, position);
ALTER TABLE public.org_invoice_line_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invoice_line_items TO authenticated;
GRANT ALL ON public.org_invoice_line_items TO service_role;
DROP POLICY IF EXISTS "org invoice items via invoice" ON public.org_invoice_line_items;
CREATE POLICY "org invoice items via invoice" ON public.org_invoice_line_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_invoices i WHERE i.id = invoice_id AND public.is_org_member(auth.uid(), i.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_invoices i WHERE i.id = invoice_id AND public.is_org_member(auth.uid(), i.organization_id)));
