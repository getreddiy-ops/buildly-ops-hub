
CREATE TABLE public.quickbooks_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  realm_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  connected_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

GRANT SELECT ON public.quickbooks_connections TO authenticated;
GRANT ALL ON public.quickbooks_connections TO service_role;
ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;

-- Org admins can see that a connection exists (token columns are sensitive but only admins can read).
CREATE POLICY "org admins read qb connection"
  ON public.quickbooks_connections FOR SELECT
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

-- Restrict token columns from direct client reads even for admins; edge functions use service_role.
REVOKE SELECT (access_token, refresh_token) ON public.quickbooks_connections FROM authenticated;

CREATE TRIGGER update_quickbooks_connections_updated_at
  BEFORE UPDATE ON public.quickbooks_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quickbooks_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  local_id uuid,
  quickbooks_id text,
  direction text NOT NULL,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quickbooks_sync_log TO authenticated;
GRANT ALL ON public.quickbooks_sync_log TO service_role;
ALTER TABLE public.quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read qb sync log"
  ON public.quickbooks_sync_log FOR SELECT
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));
