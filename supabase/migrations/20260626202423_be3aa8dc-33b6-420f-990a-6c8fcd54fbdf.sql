
-- invitations: revoke token_hash from clients
REVOKE SELECT (token_hash) ON public.invitations FROM anon, authenticated;

-- organization_members: revoke hourly_rate from clients
REVOKE SELECT (hourly_rate) ON public.organization_members FROM anon, authenticated;

-- organizations: revoke tax_id from clients
REVOKE SELECT (tax_id) ON public.organizations FROM anon, authenticated;

-- subscriptions: revoke billing identifiers from clients
REVOKE SELECT (paddle_customer_id, paddle_subscription_id) ON public.subscriptions FROM anon, authenticated;

-- Admin-only RPC for tax_id
CREATE OR REPLACE FUNCTION public.get_org_tax_id(_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tax_id FROM public.organizations
  WHERE id = _org_id
    AND (
      public.is_org_admin(auth.uid(), _org_id)
      OR public.has_platform_role(auth.uid(), 'platform_admin'::app_role)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_tax_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_tax_id(uuid) TO authenticated, service_role;
