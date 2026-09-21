-- The Studio-generated contractor schema also owns public.time_entries, but its
-- workspace/member columns are incompatible with the native FastTract app.
-- Keep both products intact by giving the native app an isolated table.
CREATE TABLE IF NOT EXISTS public.contractor_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT,
  job_title TEXT,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  clock_in_lat NUMERIC(10,7),
  clock_in_lng NUMERIC(10,7),
  clock_out_lat NUMERIC(10,7),
  clock_out_lng NUMERIC(10,7),
  approved_hours NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_time_entries_org_clock_in_idx
  ON public.contractor_time_entries (organization_id, clock_in DESC);

CREATE INDEX IF NOT EXISTS contractor_time_entries_user_org_idx
  ON public.contractor_time_entries (user_id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_time_entries_one_open_shift_idx
  ON public.contractor_time_entries (organization_id, user_id)
  WHERE clock_out IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractor_time_entries TO authenticated;
GRANT ALL ON public.contractor_time_entries TO service_role;

ALTER TABLE public.contractor_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor time own read" ON public.contractor_time_entries;
CREATE POLICY "contractor time own read"
  ON public.contractor_time_entries
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_org_admin((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "contractor time own insert" ON public.contractor_time_entries;
CREATE POLICY "contractor time own insert"
  ON public.contractor_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_org_member((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "contractor time own update" ON public.contractor_time_entries;
CREATE POLICY "contractor time own update"
  ON public.contractor_time_entries
  FOR UPDATE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR public.is_org_admin((SELECT auth.uid()), organization_id)
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()) AND public.is_org_member((SELECT auth.uid()), organization_id))
    OR public.is_org_admin((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "contractor time admin delete" ON public.contractor_time_entries;
CREATE POLICY "contractor time admin delete"
  ON public.contractor_time_entries
  FOR DELETE TO authenticated
  USING (public.is_org_admin((SELECT auth.uid()), organization_id));
