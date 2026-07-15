DROP POLICY IF EXISTS "time own update pending" ON public.time_entries;
CREATE POLICY "time own update pending" ON public.time_entries
FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending'::time_entry_status)
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'::time_entry_status
  AND public.is_org_member(auth.uid(), organization_id)
);