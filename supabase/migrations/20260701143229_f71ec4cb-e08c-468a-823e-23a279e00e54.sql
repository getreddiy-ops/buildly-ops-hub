
REVOKE SELECT (token_hash) ON public.invitations FROM authenticated;
REVOKE SELECT (hourly_rate) ON public.organization_members FROM authenticated;
REVOKE SELECT (tax_id) ON public.organizations FROM authenticated;
REVOKE SELECT (realm_id) ON public.quickbooks_connections FROM authenticated;
