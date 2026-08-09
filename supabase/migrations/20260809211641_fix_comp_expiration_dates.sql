-- Complimentary subscriptions follow the same environment, status, and expiration
-- rules as paid subscriptions. A NULL period end means intentionally unlimited access.
-- Earlier unlimited comps were represented as a date roughly 100 years away.
UPDATE public.subscriptions
SET current_period_end = NULL,
    updated_at = now()
WHERE comped = true
  AND current_period_end > now() + interval '90 years';

CREATE OR REPLACE FUNCTION public.has_active_org_subscription(org_id uuid, check_env text DEFAULT 'live'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.subscriptions
    where organization_id = org_id
      and environment = check_env
      and (
        (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (status in ('active','trialing') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$function$;
