create table if not exists public.highlevel_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  event_type text not null,
  location_id text,
  company_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists highlevel_events_event_type_idx
  on public.highlevel_events (event_type);

create index if not exists highlevel_events_location_id_idx
  on public.highlevel_events (location_id);

create index if not exists highlevel_events_received_at_idx
  on public.highlevel_events (received_at desc);

alter table public.highlevel_events enable row level security;

comment on table public.highlevel_events is
  'Verified raw GoHighLevel webhook events. Written by the service-role Edge Function only.';
