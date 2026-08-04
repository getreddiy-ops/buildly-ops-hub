-- The existing index is PARTIAL (WHERE stripe_subscription_id IS NOT NULL), which
-- Postgres cannot infer for ON CONFLICT (stripe_subscription_id). Replace it with a
-- full unique constraint so the Stripe webhook upsert works.
DROP INDEX IF EXISTS public.subscriptions_stripe_subscription_id_key;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_created
  ON public.subscriptions (organization_id, created_at DESC);

-- Track a pending downgrade that takes effect at period end
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_price_id text,
  ADD COLUMN IF NOT EXISTS scheduled_change_at timestamptz;

-- Trial abuse: allow lookup of prior trials by the owning user, not just the org
CREATE INDEX IF NOT EXISTS idx_billing_customers_user
  ON public.billing_customers (user_id);