create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  message_id text,
  template_name text not null,
  recipient_email text not null,
  status text not null,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_send_log_message_status_idx
  on public.email_send_log (message_id, status);
create index if not exists email_send_log_created_idx
  on public.email_send_log (created_at desc);

create table if not exists public.email_send_state (
  id integer primary key default 1,
  retry_after_until timestamptz,
  batch_size integer not null default 10,
  send_delay_ms integer not null default 200,
  auth_email_ttl_minutes integer not null default 15,
  transactional_email_ttl_minutes integer not null default 60,
  updated_at timestamptz not null default now()
);

insert into public.email_send_state (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.email_unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  token text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.suppressed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null default 'suppressed',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_queue (
  msg_id bigint generated always as identity primary key,
  queue_name text not null,
  message jsonb not null,
  read_ct integer not null default 0,
  enqueued_at timestamptz not null default now(),
  visible_at timestamptz not null default now()
);

create index if not exists email_queue_ready_idx
  on public.email_queue (queue_name, visible_at, msg_id);

alter table public.email_send_log enable row level security;
alter table public.email_send_state enable row level security;
alter table public.email_unsubscribe_tokens enable row level security;
alter table public.suppressed_emails enable row level security;
alter table public.email_queue enable row level security;

create or replace function public.enqueue_email(queue_name text, payload jsonb)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.email_queue (queue_name, message)
  values ($1, $2)
  returning msg_id;
$$;

create or replace function public.read_email_batch(queue_name text, batch_size integer, vt integer)
returns table(msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
security definer
set search_path = public
as $$
  with picked as (
    select q.msg_id
    from public.email_queue q
    where q.queue_name = $1
      and q.visible_at <= now()
    order by q.msg_id
    for update skip locked
    limit greatest($2, 1)
  )
  update public.email_queue q
  set read_ct = q.read_ct + 1,
      visible_at = now() + make_interval(secs => greatest($3, 1))
  from picked
  where q.msg_id = picked.msg_id
  returning q.msg_id, q.read_ct, q.enqueued_at, q.message;
$$;

create or replace function public.delete_email(queue_name text, message_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.email_queue
  where email_queue.queue_name = $1
    and email_queue.msg_id = $2;
$$;

create or replace function public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_queue (queue_name, message)
  values (dlq_name, payload);

  delete from public.email_queue
  where email_queue.queue_name = source_queue
    and email_queue.msg_id = message_id;
end;
$$;

revoke all on function public.enqueue_email(text, jsonb) from public, anon, authenticated;
revoke all on function public.read_email_batch(text, integer, integer) from public, anon, authenticated;
revoke all on function public.delete_email(text, bigint) from public, anon, authenticated;
revoke all on function public.move_to_dlq(text, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_email(text, jsonb) to service_role;
grant execute on function public.read_email_batch(text, integer, integer) to service_role;
grant execute on function public.delete_email(text, bigint) to service_role;
grant execute on function public.move_to_dlq(text, text, bigint, jsonb) to service_role;
