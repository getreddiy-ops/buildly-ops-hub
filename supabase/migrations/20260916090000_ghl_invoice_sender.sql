-- Send Invoice requires a HighLevel userId (the "employee or agency ID"
-- recorded as the invoice's sender). There's no safe way to infer this --
-- FastTract asks the org to pick one from their own HighLevel users
-- (Preferences -> GoHighLevel), the same way default_calendar_id already
-- works for appointment sync.
alter table public.ghl_connections
  add column if not exists default_sender_user_id text;
