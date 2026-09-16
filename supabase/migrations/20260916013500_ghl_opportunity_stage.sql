-- Tracks the GHL opportunity pipeline stage for a lead so inbound
-- OpportunityCreate/OpportunityStatusUpdate webhooks can reflect pipeline
-- movement without forcing GHL's stage names into the fixed lead_status enum.
alter table public.leads
  add column if not exists ghl_pipeline_stage text;
