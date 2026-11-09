-- User-scoped, idempotent deletion intake. Fulfillment remains an operator task;
-- never delete a shared company as a side effect of requesting account deletion.
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed'))
);
create index account_deletion_requests_pending_due_idx
  on public.account_deletion_requests (due_at) where status <> 'completed';
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant insert (user_id) on public.account_deletion_requests to authenticated;
create policy deletion_requests_read_self on public.account_deletion_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy deletion_requests_insert_self on public.account_deletion_requests
  for insert to authenticated with check (user_id = (select auth.uid()));

create function public.request_account_deletion() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.account_deletion_requests (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
end;
$$;
create function public.get_account_deletion_request()
returns table (requested_at timestamptz, status text)
language sql stable security invoker set search_path = '' as $$
  select r.requested_at, r.status from public.account_deletion_requests r
  where r.user_id = (select auth.uid());
$$;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.get_account_deletion_request() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.get_account_deletion_request() to authenticated;
