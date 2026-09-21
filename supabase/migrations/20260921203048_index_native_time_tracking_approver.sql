CREATE INDEX IF NOT EXISTS contractor_time_entries_approved_by_idx
  ON public.contractor_time_entries (approved_by);
