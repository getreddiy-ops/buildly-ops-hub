GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

DROP POLICY IF EXISTS "orgs members read" ON public.organizations;
CREATE POLICY "orgs members and owners read"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR is_org_member(auth.uid(), id)
  OR agent_id = auth.uid()
  OR has_platform_role(auth.uid(), 'platform_admin'::app_role)
);

DROP POLICY IF EXISTS "members self insert first owner" ON public.organization_members;
CREATE POLICY "members controlled insert"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE organizations.id = organization_members.organization_id
        AND organizations.owner_id = auth.uid()
    )
    OR is_org_admin(auth.uid(), organization_id)
    OR has_platform_role(auth.uid(), 'platform_admin'::app_role)
  )
);