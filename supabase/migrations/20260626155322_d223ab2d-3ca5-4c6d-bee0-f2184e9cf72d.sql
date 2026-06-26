
-- 1) Drop unused stripe billing identifiers from organizations
ALTER TABLE public.organizations DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS stripe_subscription_id;

-- 2) Prevent admins/clients from reading invitation token hashes (only service_role needs them)
REVOKE SELECT (token_hash) ON public.invitations FROM authenticated;
REVOKE SELECT (token_hash) ON public.invitations FROM anon;

-- 3) Lock down SECURITY DEFINER functions that aren't called by clients or used inside RLS policies
REVOKE EXECUTE ON FUNCTION public.org_role(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_org_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
