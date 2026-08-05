CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  admin_user_id uuid NOT NULL,
  admin_email text,
  target_user_id uuid,
  target_email text,
  target_org_id uuid,
  action text NOT NULL,
  path text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view admin audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_session ON public.admin_audit_log (session_id);