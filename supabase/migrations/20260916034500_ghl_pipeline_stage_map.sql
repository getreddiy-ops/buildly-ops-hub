-- Lets a contractor explicitly map their GHL pipeline stage names onto
-- FastTract's lead_status enum (new/contacted/qualified/won/lost), instead
-- of only ever inferring won/lost from GHL's own opportunity status field.
-- Keys are matched case-insensitively against the stage name/id GHL sends.
alter table public.ghl_connections
  add column if not exists pipeline_stage_map jsonb not null default '{}'::jsonb;
