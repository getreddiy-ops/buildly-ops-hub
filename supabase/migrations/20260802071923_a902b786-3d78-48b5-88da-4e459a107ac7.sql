ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paddle';

ALTER TABLE public.subscriptions ALTER COLUMN paddle_subscription_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN paddle_customer_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN product_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id text NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'live',
  trial_used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view billing customer" ON public.billing_customers
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manages billing customers" ON public.billing_customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_billing_customers_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages webhook events" ON public.stripe_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);