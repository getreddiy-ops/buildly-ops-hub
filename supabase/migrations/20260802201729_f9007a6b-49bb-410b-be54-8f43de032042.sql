ALTER TABLE public.phone_assistants
  ADD COLUMN IF NOT EXISTS number_source text,
  ADD COLUMN IF NOT EXISTS setup_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.phone_assistants
  DROP CONSTRAINT IF EXISTS phone_assistants_number_source_check;

ALTER TABLE public.phone_assistants
  ADD CONSTRAINT phone_assistants_number_source_check
  CHECK (number_source IS NULL OR number_source IN ('purchased','existing_twilio','forwarded','porting'));