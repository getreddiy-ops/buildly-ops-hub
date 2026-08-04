DROP POLICY IF EXISTS "Members can view org time off" ON public.time_off_requests;

CREATE POLICY "Own or admin can view time off"
ON public.time_off_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_admin(auth.uid(), organization_id)
  OR public.is_agent_of_org(auth.uid(), organization_id)
  OR public.has_platform_role(auth.uid(), 'platform_admin'::app_role)
);