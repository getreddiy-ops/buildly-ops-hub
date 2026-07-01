
CREATE TYPE public.time_off_type AS ENUM ('vacation','sick','personal','unpaid','holiday');
CREATE TYPE public.time_off_status AS ENUM ('pending','approved','denied','cancelled');

CREATE TABLE public.time_off_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours NUMERIC(6,2) NOT NULL DEFAULT 8,
  type public.time_off_type NOT NULL DEFAULT 'vacation',
  status public.time_off_status NOT NULL DEFAULT 'pending',
  note TEXT,
  reviewer_id UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.time_off_requests(organization_id, start_date);
CREATE INDEX ON public.time_off_requests(user_id, start_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_off_requests TO authenticated;
GRANT ALL ON public.time_off_requests TO service_role;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org time off"
  ON public.time_off_requests FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can request own time off"
  ON public.time_off_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND user_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Members cancel own pending, admins update any"
  ON public.time_off_requests FOR UPDATE TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR (user_id = auth.uid() AND status IN ('pending','approved'))
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR (user_id = auth.uid())
  );

CREATE POLICY "Admins delete requests"
  ON public.time_off_requests FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_time_off_requests_updated
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.pto_policies (
  organization_id UUID NOT NULL PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  accrual_hours_per_hour_worked NUMERIC(6,4),
  annual_cap_hours NUMERIC(8,2),
  carryover_cap_hours NUMERIC(8,2),
  waiting_period_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pto_policies TO authenticated;
GRANT ALL ON public.pto_policies TO service_role;
ALTER TABLE public.pto_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view policy"
  ON public.pto_policies FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Admins upsert policy"
  ON public.pto_policies FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_pto_policies_updated
  BEFORE UPDATE ON public.pto_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
