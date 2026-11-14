-- Bring-your-own AI (launch plan Phase 5): each business connects its own AI provider key.
-- The key lives in Supabase Vault. The table holds only which provider and model, the
-- last four characters, and a pointer to the Vault secret, which no client role can read.

create table if not exists public.org_ai_connections (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'google')),
  model text not null check (length(model) between 1 and 100),
  key_last4 text not null check (length(key_last4) <= 4),
  vault_secret_id uuid not null,
  status text not null default 'connected' check (status in ('connected', 'failing')),
  last_error text,
  verified_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_ai_connections enable row level security;

drop policy if exists "Members can see their business AI connection" on public.org_ai_connections;
create policy "Members can see their business AI connection"
on public.org_ai_connections for select to authenticated
using (public.is_org_member((select auth.uid()), organization_id));
-- No insert/update/delete policies: writes go through the connect-ai function (service role).

revoke all on public.org_ai_connections from anon, authenticated;
grant select (organization_id, provider, model, key_last4, status, last_error, verified_at, updated_at)
  on public.org_ai_connections to authenticated;

-- ---------- Vault-backed key functions (service role only) ----------

create or replace function public.set_org_ai_key(_org uuid, _provider text, _model text, _key text, _user uuid)
returns void
language plpgsql security definer set search_path = public, vault
as $$
declare
  _secret_id uuid;
begin
  select vault_secret_id into _secret_id from public.org_ai_connections where organization_id = _org;
  if _secret_id is null then
    _secret_id := vault.create_secret(_key, 'org_ai_key_' || _org::text, 'Bring-your-own AI key for one FastTract business');
  else
    perform vault.update_secret(_secret_id, _key);
  end if;

  insert into public.org_ai_connections (organization_id, provider, model, key_last4, vault_secret_id, status, last_error, verified_at, updated_by, updated_at)
  values (_org, _provider, _model, right(_key, 4), _secret_id, 'connected', null, now(), _user, now())
  on conflict (organization_id) do update
    set provider = excluded.provider, model = excluded.model, key_last4 = excluded.key_last4,
        vault_secret_id = excluded.vault_secret_id, status = 'connected', last_error = null,
        verified_at = now(), updated_by = excluded.updated_by, updated_at = now();
end;
$$;

create or replace function public.get_org_ai_key(_org uuid)
returns table (provider text, model text, api_key text)
language sql security definer set search_path = public, vault stable
as $$
  select c.provider, c.model, s.decrypted_secret
  from public.org_ai_connections c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.organization_id = _org;
$$;

create or replace function public.delete_org_ai_key(_org uuid)
returns void
language plpgsql security definer set search_path = public, vault
as $$
declare
  _secret_id uuid;
begin
  delete from public.org_ai_connections where organization_id = _org returning vault_secret_id into _secret_id;
  if _secret_id is not null then
    delete from vault.secrets where id = _secret_id;
  end if;
end;
$$;

create or replace function public.mark_org_ai_failing(_org uuid, _error text)
returns void
language sql security definer set search_path = public
as $$
  update public.org_ai_connections set status = 'failing', last_error = left(_error, 300), updated_at = now()
  where organization_id = _org;
$$;

revoke all on function public.set_org_ai_key(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.get_org_ai_key(uuid) from public, anon, authenticated;
revoke all on function public.delete_org_ai_key(uuid) from public, anon, authenticated;
revoke all on function public.mark_org_ai_failing(uuid, text) from public, anon, authenticated;
grant execute on function public.set_org_ai_key(uuid, text, text, text, uuid) to service_role;
grant execute on function public.get_org_ai_key(uuid) to service_role;
grant execute on function public.delete_org_ai_key(uuid) to service_role;
grant execute on function public.mark_org_ai_failing(uuid, text) to service_role;
