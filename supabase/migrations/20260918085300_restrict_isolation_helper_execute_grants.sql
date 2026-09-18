-- ALREADY APPLIED to project qjusjfdrtposrthlcjeu on 2026-09-18. Record only.
-- Follow-up to 20260918084720.
--
-- Postgres gives every newly created function a default EXECUTE grant to PUBLIC,
-- which includes Supabase's `anon` role. So the two helpers added in the previous
-- migration were reachable unauthenticated at /rest/v1/rpc/<name>. shares_org_with()
-- is a membership oracle (probe whether two user ids belong to the same org), so this
-- revokes PUBLIC/anon and keeps only the roles that need it:
--   authenticated  -- RLS policy expressions are evaluated as the querying role
--   service_role
revoke all on function public.can_bootstrap_org_membership(uuid, uuid) from public;
revoke all on function public.can_bootstrap_org_membership(uuid, uuid) from anon;
revoke all on function public.shares_org_with(uuid, uuid) from public;
revoke all on function public.shares_org_with(uuid, uuid) from anon;

grant execute on function public.can_bootstrap_org_membership(uuid, uuid) to authenticated, service_role;
grant execute on function public.shares_org_with(uuid, uuid) to authenticated, service_role;
