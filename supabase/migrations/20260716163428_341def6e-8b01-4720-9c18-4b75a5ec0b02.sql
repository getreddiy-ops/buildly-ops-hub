
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_org_created ON public.ai_usage(organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);

GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view org AI usage"
  ON public.ai_usage FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "Platform admins can view all AI usage"
  ON public.ai_usage FOR SELECT
  TO authenticated
  USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));
