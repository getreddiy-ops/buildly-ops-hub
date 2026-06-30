
-- 1) Grant platform_admin to getreddiy@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('c75a218c-245a-4436-827f-bbd85090ec34'::uuid, 'platform_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Let platform admins read every subscription (for support views)
DROP POLICY IF EXISTS "platform admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "platform admins read all subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

-- 3) Let platform admins update subscriptions (comp trials, cancel, etc.)
DROP POLICY IF EXISTS "platform admins update subscriptions" ON public.subscriptions;
CREATE POLICY "platform admins update subscriptions"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

-- 4) Let platform admins read every org member (already true for profiles via existing policy)
DROP POLICY IF EXISTS "platform admins read all members" ON public.organization_members;
CREATE POLICY "platform admins read all members"
ON public.organization_members FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

-- 5) Support notes table — internal notes the support team writes about an org
CREATE TABLE IF NOT EXISTS public.support_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_notes TO authenticated;
GRANT ALL ON public.support_notes TO service_role;

ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins manage support notes"
ON public.support_notes FOR ALL
TO authenticated
USING (public.has_platform_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (public.has_platform_role(auth.uid(), 'platform_admin'::app_role));

CREATE INDEX IF NOT EXISTS support_notes_org_idx ON public.support_notes(organization_id, created_at DESC);

CREATE TRIGGER support_notes_updated_at
BEFORE UPDATE ON public.support_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
