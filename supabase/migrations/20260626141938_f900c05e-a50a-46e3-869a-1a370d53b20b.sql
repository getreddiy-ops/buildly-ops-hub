
-- Platform admins can read all profiles (for Admin Users page)
CREATE POLICY "profiles platform admin read" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_admin'));

-- Agents can read profiles of members of their client organizations
CREATE POLICY "profiles agent of org read" ON public.profiles
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = profiles.id AND o.agent_id = auth.uid()
));

-- Platform admin sees ai_actions across all orgs (audit log)
DROP POLICY IF EXISTS "ai_actions org admin" ON public.ai_actions;
CREATE POLICY "ai_actions read" ON public.ai_actions
FOR SELECT TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.has_platform_role(auth.uid(), 'platform_admin')
);
CREATE POLICY "ai_actions write" ON public.ai_actions
FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND user_id = auth.uid());

-- Allow agents to read leads of their client orgs (lead-sharing visibility)
CREATE POLICY "leads agent read" ON public.leads
FOR SELECT TO authenticated
USING (public.is_agent_of_org(auth.uid(), organization_id));

-- Allow agents to insert leads into their client orgs (lead sharing write)
CREATE POLICY "leads agent insert" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (public.is_agent_of_org(auth.uid(), organization_id));
