
-- 1) USER_ROLES: explicit restrictive policies preventing self-grant of roles
CREATE POLICY "user_roles deny self insert" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "user_roles deny self update" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "user_roles deny self delete" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

-- 2) ORGANIZATION_MEMBERS: remove agent visibility (protects hourly_rate)
DROP POLICY IF EXISTS "members read" ON public.organization_members;
CREATE POLICY "members read" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_platform_role(auth.uid(), 'platform_admin'::app_role)
  );

-- 3) ORGANIZATIONS: hide stripe identifiers via column-level privileges
REVOKE SELECT ON public.organizations FROM authenticated, anon;
GRANT SELECT (id, name, slug, owner_id, agent_id, plan, created_at, updated_at)
  ON public.organizations TO authenticated;
-- service_role retains full access via ALL grant elsewhere

-- 4) INVITATIONS: hash token at rest
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS token_hash text;
UPDATE public.invitations
  SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  WHERE token_hash IS NULL AND token IS NOT NULL;
ALTER TABLE public.invitations DROP COLUMN IF EXISTS token;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_hash_key ON public.invitations(token_hash);

-- 5) PHONE_CALLS: explicit restrictive write policies (only service_role may write)
CREATE POLICY "phone_calls deny insert" ON public.phone_calls
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "phone_calls deny update" ON public.phone_calls
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "phone_calls deny delete" ON public.phone_calls
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- 6) SECURITY DEFINER functions: restrict EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_platform_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_agent_of_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_org_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agent_of_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_org_subscription(uuid, text) TO authenticated;
