update public.estimates
set share_token = replace(gen_random_uuid()::text, '-', '')
where share_token is null or btrim(share_token) = '';

alter table public.estimates
  alter column share_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column share_token set not null;

create unique index if not exists estimates_share_token_key
  on public.estimates (share_token);
