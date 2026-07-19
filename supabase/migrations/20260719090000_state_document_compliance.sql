-- State-aware document compliance guardrails.
--
-- Legal text is deliberately not invented here. Every jurisdiction/document
-- pair starts in "needs_review" and must be populated from authoritative
-- sources and approved before a customer-facing document can leave draft.

create table public.us_jurisdictions (
  state_code text primary key check (state_code ~ '^[A-Z]{2}$'),
  state_name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.us_jurisdictions (state_code, state_name) values
  ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
  ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('FL','Florida'),('GA','Georgia'),
  ('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
  ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),
  ('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),('MO','Missouri'),
  ('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),
  ('NM','New Mexico'),('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
  ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),
  ('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),
  ('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming'),
  ('DC','District of Columbia')
on conflict (state_code) do update set state_name = excluded.state_name;

alter table public.us_jurisdictions enable row level security;
grant select on public.us_jurisdictions to authenticated;
grant all on public.us_jurisdictions to service_role;
create policy "authenticated can read US jurisdictions"
  on public.us_jurisdictions for select to authenticated using (true);

create table public.state_compliance_rules (
  id uuid primary key default gen_random_uuid(),
  state_code text not null references public.us_jurisdictions(state_code),
  document_type text not null check (document_type in ('estimate','invoice','contract')),
  version integer not null default 1 check (version > 0),
  status text not null default 'needs_review'
    check (status in ('needs_review','approved','retired')),
  required_text text not null default '',
  ai_guidance text not null default '',
  source_citations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_citations) = 'array'),
  effective_on date,
  expires_on date,
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, document_type, version),
  check (
    status <> 'approved' or (
      length(trim(required_text)) > 0
      and jsonb_array_length(source_citations) > 0
      and reviewed_at is not null
      and length(trim(reviewed_by)) > 0
      and effective_on is not null
    )
  ),
  check (expires_on is null or effective_on is null or expires_on >= effective_on)
);

insert into public.state_compliance_rules (state_code, document_type, version, status)
select j.state_code, d.document_type, 1, 'needs_review'
from public.us_jurisdictions j
cross join (values ('estimate'), ('invoice'), ('contract')) as d(document_type)
on conflict (state_code, document_type, version) do nothing;

create index state_compliance_rules_active_lookup
  on public.state_compliance_rules (state_code, document_type, version desc)
  where status = 'approved';

alter table public.state_compliance_rules enable row level security;
grant select, insert, update, delete on public.state_compliance_rules to authenticated;
grant all on public.state_compliance_rules to service_role;
create policy "authenticated can read approved compliance rules"
  on public.state_compliance_rules for select to authenticated
  using (
    status = 'approved'
    and effective_on <= current_date
    and (expires_on is null or expires_on >= current_date)
  );
create policy "platform admins manage compliance rules"
  on public.state_compliance_rules for all to authenticated
  using (public.has_platform_role((select auth.uid()), 'platform_admin'::public.app_role))
  with check (public.has_platform_role((select auth.uid()), 'platform_admin'::public.app_role));

create trigger state_compliance_rules_updated
  before update on public.state_compliance_rules
  for each row execute function public.update_updated_at_column();

alter table public.estimates
  add column compliance_state_code text references public.us_jurisdictions(state_code),
  add column compliance_rule_version integer,
  add column compliance_snapshot jsonb,
  add column compliance_verified_at timestamptz;

alter table public.invoices
  add column compliance_state_code text references public.us_jurisdictions(state_code),
  add column compliance_rule_version integer,
  add column compliance_snapshot jsonb,
  add column compliance_verified_at timestamptz;

alter table public.contracts
  add column compliance_state_code text references public.us_jurisdictions(state_code),
  add column compliance_rule_version integer,
  add column compliance_snapshot jsonb,
  add column compliance_verified_at timestamptz;

create or replace function public.extract_us_state_code(address_text text)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  candidate text;
  jurisdiction record;
begin
  if address_text is null or length(trim(address_text)) = 0 then
    return null;
  end if;

  -- Prefer a USPS-style state abbreviation near a ZIP code.
  select upper(match[1]) into candidate
  from regexp_matches(upper(address_text),
    '(?:^|[^A-Z])([A-Z]{2})[[:space:]]+[0-9]{5}(?:-[0-9]{4})?(?:$|[^0-9])') as match
  limit 1;

  if candidate is not null and exists (
    select 1 from public.us_jurisdictions where state_code = candidate
  ) then
    return candidate;
  end if;

  -- Then accept a comma-delimited two-letter state value.
  select upper(match[1]) into candidate
  from regexp_matches(upper(address_text),
    ',[[:space:]]*([A-Z]{2})(?:[[:space:],]|$)') as match
  limit 1;

  if candidate is not null and exists (
    select 1 from public.us_jurisdictions where state_code = candidate
  ) then
    return candidate;
  end if;

  -- Finally match a full state name using non-letter boundaries.
  for jurisdiction in
    select state_code, state_name
    from public.us_jurisdictions
    order by length(state_name) desc
  loop
    if lower(address_text) ~ (
      '(^|[^a-z])' || replace(lower(jurisdiction.state_name), ' ', '[[:space:]]+') || '([^a-z]|$)'
    ) then
      return jurisdiction.state_code;
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.extract_us_state_code(text) from public;
grant execute on function public.extract_us_state_code(text) to authenticated, service_role;

create or replace function public.resolve_document_compliance(
  p_document_type text,
  p_customer_id uuid,
  p_job_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job_address text;
  customer_address text;
  service_address text;
  state_code_value text;
  state_name_value text;
  selected_rule public.state_compliance_rules%rowtype;
begin
  if p_document_type not in ('estimate','invoice','contract') then
    raise exception using
      errcode = '22023',
      message = 'Unsupported document type for compliance review.';
  end if;

  if p_job_id is not null then
    select nullif(trim(address), '') into job_address
    from public.jobs where id = p_job_id;
  end if;

  if p_customer_id is not null then
    select nullif(trim(address), '') into customer_address
    from public.customers where id = p_customer_id;
  end if;

  service_address := coalesce(job_address, customer_address);
  state_code_value := public.extract_us_state_code(service_address);

  if service_address is null then
    raise exception using
      errcode = 'P0001',
      message = 'Compliance review required: add the customer or job-site address before finalizing this document.',
      hint = 'A complete service address with a US state is required.';
  end if;

  if state_code_value is null then
    raise exception using
      errcode = 'P0001',
      message = 'Compliance review required: FastTract could not determine the job-site state from the address.',
      hint = 'Use a complete address such as 123 Main St, Seattle, WA 98101.';
  end if;

  select state_name into state_name_value
  from public.us_jurisdictions where state_code = state_code_value;

  select * into selected_rule
  from public.state_compliance_rules
  where state_code = state_code_value
    and document_type = p_document_type
    and status = 'approved'
    and effective_on <= current_date
    and (expires_on is null or expires_on >= current_date)
  order by version desc
  limit 1;

  if selected_rule.id is null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Compliance review required: the %s rules for %s have not been approved or are out of date.',
        p_document_type,
        state_name_value
      ),
      hint = 'Keep this document as a draft until an approved state rule is available.';
  end if;

  return jsonb_build_object(
    'state_code', state_code_value,
    'state_name', state_name_value,
    'document_type', p_document_type,
    'job_site_address', service_address,
    'rule_id', selected_rule.id,
    'rule_version', selected_rule.version,
    'required_text', selected_rule.required_text,
    'source_citations', selected_rule.source_citations,
    'effective_on', selected_rule.effective_on,
    'reviewed_at', selected_rule.reviewed_at,
    'verified_at', now()
  );
end;
$$;

revoke all on function public.resolve_document_compliance(text, uuid, uuid) from public;
grant execute on function public.resolve_document_compliance(text, uuid, uuid) to service_role;

create or replace function public.enforce_document_compliance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  customer_id_value uuid;
  job_id_value uuid;
begin
  customer_id_value := nullif(to_jsonb(new)->>'customer_id', '')::uuid;
  job_id_value := nullif(to_jsonb(new)->>'job_id', '')::uuid;

  if tg_op = 'INSERT' and new.status = 'draft' then
    new.compliance_state_code := null;
    new.compliance_rule_version := null;
    new.compliance_snapshot := null;
    new.compliance_verified_at := null;
    return new;
  end if;

  -- A draft may be edited freely, but any old verification becomes invalid.
  if new.status = 'draft' then
    if old.status <> 'draft'
      or to_jsonb(new)->>'customer_id' is distinct from to_jsonb(old)->>'customer_id'
      or to_jsonb(new)->>'job_id' is distinct from to_jsonb(old)->>'job_id'
    then
      new.compliance_state_code := null;
      new.compliance_rule_version := null;
      new.compliance_snapshot := null;
      new.compliance_verified_at := null;
    end if;
    return new;
  end if;

  if new.compliance_snapshot is null
    or tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and old.status = 'draft')
    or to_jsonb(new)->>'customer_id' is distinct from to_jsonb(old)->>'customer_id'
    or to_jsonb(new)->>'job_id' is distinct from to_jsonb(old)->>'job_id'
  then
    snapshot := public.resolve_document_compliance(tg_argv[0], customer_id_value, job_id_value);
    new.compliance_state_code := snapshot->>'state_code';
    new.compliance_rule_version := (snapshot->>'rule_version')::integer;
    new.compliance_snapshot := snapshot;
    new.compliance_verified_at := (snapshot->>'verified_at')::timestamptz;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_document_compliance() from public;

create trigger enforce_estimate_compliance
  before insert or update on public.estimates
  for each row execute function public.enforce_document_compliance('estimate');
create trigger enforce_invoice_compliance
  before insert or update on public.invoices
  for each row execute function public.enforce_document_compliance('invoice');
create trigger enforce_contract_compliance
  before insert or update on public.contracts
  for each row execute function public.enforce_document_compliance('contract');

create or replace function public.prepare_document_compliance(
  p_document_type text,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text;
  customer_id_value uuid;
  job_id_value uuid;
  snapshot jsonb;
begin
  table_name := case p_document_type
    when 'estimate' then 'estimates'
    when 'invoice' then 'invoices'
    when 'contract' then 'contracts'
    else null
  end;

  if table_name is null then
    raise exception using errcode = '22023', message = 'Unsupported document type.';
  end if;

  execute format(
    'select customer_id, nullif(to_jsonb(t)->>''job_id'', '''')::uuid from public.%I t where id = $1',
    table_name
  ) into customer_id_value, job_id_value using p_document_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Document not found.';
  end if;

  snapshot := public.resolve_document_compliance(p_document_type, customer_id_value, job_id_value);

  execute format(
    'update public.%I set compliance_state_code = $1, compliance_rule_version = $2, compliance_snapshot = $3, compliance_verified_at = $4 where id = $5',
    table_name
  ) using
    snapshot->>'state_code',
    (snapshot->>'rule_version')::integer,
    snapshot,
    (snapshot->>'verified_at')::timestamptz,
    p_document_id;

  return snapshot;
end;
$$;

revoke all on function public.prepare_document_compliance(text, uuid) from public;
grant execute on function public.prepare_document_compliance(text, uuid) to service_role;
