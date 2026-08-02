DROP POLICY IF EXISTS "profiles same org read" ON public.profiles;

CREATE POLICY "profiles org admin read"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = profiles.id
      AND public.is_org_admin(auth.uid(), m.organization_id)
  )
);

CREATE OR REPLACE FUNCTION public.get_org_roster(_org_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT om.user_id, p.full_name
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = _org_id
    AND (
      public.is_org_member(auth.uid(), _org_id)
      OR public.is_agent_of_org(auth.uid(), _org_id)
      OR public.has_platform_role(auth.uid(), 'platform_admin'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_org_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_roster(uuid) TO authenticated;