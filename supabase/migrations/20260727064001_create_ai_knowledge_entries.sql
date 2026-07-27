CREATE TABLE IF NOT EXISTS public.ai_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_key TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'conversation',
  approved BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source, knowledge_key)
);

CREATE INDEX IF NOT EXISTS ai_knowledge_entries_org_approved_idx
  ON public.ai_knowledge_entries (organization_id, approved, updated_at DESC);

ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_entries TO authenticated;
GRANT ALL ON public.ai_knowledge_entries TO service_role;

DROP POLICY IF EXISTS "Organization members can read approved AI knowledge"
  ON public.ai_knowledge_entries;
CREATE POLICY "Organization members can read approved AI knowledge"
  ON public.ai_knowledge_entries
  FOR SELECT
  TO authenticated
  USING (public.is_org_member((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS "Organization members can add their approved AI knowledge"
  ON public.ai_knowledge_entries;
CREATE POLICY "Organization members can add their approved AI knowledge"
  ON public.ai_knowledge_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_org_member((SELECT auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "Organization members can update their AI knowledge"
  ON public.ai_knowledge_entries;
CREATE POLICY "Organization members can update their AI knowledge"
  ON public.ai_knowledge_entries
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member((SELECT auth.uid()), organization_id))
  WITH CHECK (public.is_org_member((SELECT auth.uid()), organization_id));

DROP POLICY IF EXISTS "Organization admins can delete AI knowledge"
  ON public.ai_knowledge_entries;
CREATE POLICY "Organization admins can delete AI knowledge"
  ON public.ai_knowledge_entries
  FOR DELETE
  TO authenticated
  USING (public.is_org_admin((SELECT auth.uid()), organization_id));

DROP TRIGGER IF EXISTS ai_knowledge_entries_updated
  ON public.ai_knowledge_entries;
CREATE TRIGGER ai_knowledge_entries_updated
  BEFORE UPDATE ON public.ai_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
