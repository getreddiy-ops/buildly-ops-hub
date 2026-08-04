CREATE OR REPLACE FUNCTION public.get_stripe_webhook_health()
RETURNS TABLE(
  last_event_at timestamptz,
  last_event_type text,
  events_24h bigint,
  events_7d bigint,
  events_total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT max(processed_at) FROM public.stripe_webhook_events),
    (SELECT type FROM public.stripe_webhook_events ORDER BY processed_at DESC LIMIT 1),
    (SELECT count(*) FROM public.stripe_webhook_events WHERE processed_at > now() - interval '24 hours'),
    (SELECT count(*) FROM public.stripe_webhook_events WHERE processed_at > now() - interval '7 days'),
    (SELECT count(*) FROM public.stripe_webhook_events)
  WHERE public.has_platform_role(auth.uid(), 'platform_admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.get_stripe_webhook_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_stripe_webhook_health() TO authenticated;