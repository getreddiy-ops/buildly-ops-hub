ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

REVOKE SELECT ON public.organizations FROM authenticated;
REVOKE SELECT ON public.organizations FROM anon;
GRANT SELECT (
  id, name, slug, owner_id, agent_id, plan, created_at, updated_at,
  business_profile, logo_url, brand_color, brand_color_secondary,
  legal_name, address, phone, email, website, document_defaults
) ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;