create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sent_by uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('sms','email')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound')),
  recipient text not null,
  sender text,
  body text not null,
  provider text not null,
  provider_id text,
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists communication_messages_org_created_idx
  on public.communication_messages (organization_id, created_at desc);
create index if not exists communication_messages_customer_created_idx
  on public.communication_messages (customer_id, created_at desc);

alter table public.communication_messages enable row level security;

drop policy if exists "Members can read communication messages" on public.communication_messages;
create policy "Members can read communication messages"
on public.communication_messages
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = communication_messages.organization_id
      and om.user_id = (select auth.uid())
  )
);

drop policy if exists "Members can create communication messages" on public.communication_messages;
create policy "Members can create communication messages"
on public.communication_messages
for insert
to authenticated
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = communication_messages.organization_id
      and om.user_id = (select auth.uid())
  )
);
