-- Workers may clock in/out and edit pending self-entries, but must not set
-- approval fields (status, approved_hours, approved_by, approved_at).
-- Admins keep full update rights for the Approvals workflow.

DROP POLICY IF EXISTS "contractor time own insert" ON public.contractor_time_entries;
CREATE POLICY "contractor time own insert"
  ON public.contractor_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_org_member((SELECT auth.uid()), organization_id)
    AND status = 'pending'
    AND approved_hours IS NULL
    AND approved_by IS NULL
    AND approved_at IS NULL
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
    (
      user_id = (SELECT auth.uid())
      AND public.is_org_member((SELECT auth.uid()), organization_id)
      AND status = 'pending'
      AND approved_hours IS NULL
      AND approved_by IS NULL
      AND approved_at IS NULL
    )
    OR public.is_org_admin((SELECT auth.uid()), organization_id)
  );
