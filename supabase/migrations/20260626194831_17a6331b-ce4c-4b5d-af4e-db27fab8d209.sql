
-- 1. invitations: revoke column-level SELECT on token_hash from clients
REVOKE SELECT (token_hash) ON public.invitations FROM authenticated;
REVOKE SELECT (token_hash) ON public.invitations FROM anon;

-- 2. organization_members: revoke column-level SELECT on hourly_rate from clients,
-- expose via security definer RPC restricted to org admins.
REVOKE SELECT (hourly_rate) ON public.organization_members FROM authenticated;
REVOKE SELECT (hourly_rate) ON public.organization_members FROM anon;

CREATE OR REPLACE FUNCTION public.get_org_hourly_rates(_org_id uuid)
RETURNS TABLE (user_id uuid, hourly_rate numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.user_id, om.hourly_rate
  FROM public.organization_members om
  WHERE om.organization_id = _org_id
    AND (
      public.is_org_admin(auth.uid(), _org_id)
      OR public.has_platform_role(auth.uid(), 'platform_admin'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_org_hourly_rates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_hourly_rates(uuid) TO authenticated;

-- 3. Scope policies to authenticated role only.
DROP POLICY IF EXISTS "invoices org members" ON public.invoices;
CREATE POLICY "invoices org members" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "invoice items via invoice" ON public.invoice_line_items;
CREATE POLICY "invoice items via invoice" ON public.invoice_line_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND public.is_org_member(auth.uid(), i.organization_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND public.is_org_member(auth.uid(), i.organization_id)
  ));

DROP POLICY IF EXISTS "contracts org members" ON public.contracts;
CREATE POLICY "contracts org members" ON public.contracts
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
