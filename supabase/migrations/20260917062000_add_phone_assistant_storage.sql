create table if not exists public.phone_assistants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  enabled boolean not null default true,
  voice_id text not null default 'EXAVITQu4vr4xnSDxMaL',
  greeting text not null default '',
  transfer_number text,
  capabilities jsonb not null default '{}'::jsonb,
  elevenlabs_agent_id text,
  twilio_phone_number text,
  twilio_phone_sid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists phone_assistants_elevenlabs_agent_id_key
  on public.phone_assistants(elevenlabs_agent_id)
  where elevenlabs_agent_id is not null;
create unique index if not exists phone_assistants_twilio_phone_number_key
  on public.phone_assistants(twilio_phone_number)
  where twilio_phone_number is not null;
create unique index if not exists phone_assistants_twilio_phone_sid_key
  on public.phone_assistants(twilio_phone_sid)
  where twilio_phone_sid is not null;

create table if not exists public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_number text,
  to_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text not null default 'in_progress',
  outcome text,
  summary text,
  transcript jsonb,
  elevenlabs_conversation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists phone_calls_org_started_idx
  on public.phone_calls(organization_id, started_at desc);
create unique index if not exists phone_calls_elevenlabs_conversation_id_key
  on public.phone_calls(elevenlabs_conversation_id)
  where elevenlabs_conversation_id is not null;

alter table public.phone_assistants enable row level security;
alter table public.phone_calls enable row level security;

drop policy if exists "Org members can view phone assistants" on public.phone_assistants;
create policy "Org members can view phone assistants"
on public.phone_assistants for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = phone_assistants.organization_id
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Org admins can manage phone assistants" on public.phone_assistants;
create policy "Org admins can manage phone assistants"
on public.phone_assistants for all to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = phone_assistants.organization_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = phone_assistants.organization_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
);

drop policy if exists "Org members can view phone calls" on public.phone_calls;
create policy "Org members can view phone calls"
on public.phone_calls for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = phone_calls.organization_id
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Org admins can manage phone calls" on public.phone_calls;
create policy "Org admins can manage phone calls"
on public.phone_calls for all to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = phone_calls.organization_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = phone_calls.organization_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
);
