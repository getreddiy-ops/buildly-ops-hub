
CREATE TABLE public.phone_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  voice_id text NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  greeting text NOT NULL DEFAULT 'Hi, you have reached our office. I can help schedule an estimate, take a message, or transfer you to a team member.',
  transfer_number text,
  capabilities jsonb NOT NULL DEFAULT '{"book_estimates":true,"capture_leads":true,"transfer":true,"voicemail":true,"sms_followup":false,"faq":true}'::jsonb,
  elevenlabs_agent_id text,
  elevenlabs_phone_id text,
  twilio_phone_sid text,
  twilio_phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_assistants TO authenticated;
GRANT ALL ON public.phone_assistants TO service_role;
ALTER TABLE public.phone_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read phone_assistants" ON public.phone_assistants
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "admins write phone_assistants" ON public.phone_assistants
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_phone_assistants_updated
  BEFORE UPDATE ON public.phone_assistants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.phone_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_number text,
  to_number text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'in_progress',
  outcome text,
  summary text,
  transcript jsonb,
  recording_url text,
  elevenlabs_conversation_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_calls_org_started_idx ON public.phone_calls (organization_id, started_at DESC);

GRANT SELECT ON public.phone_calls TO authenticated;
GRANT ALL ON public.phone_calls TO service_role;
ALTER TABLE public.phone_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read phone_calls" ON public.phone_calls
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
