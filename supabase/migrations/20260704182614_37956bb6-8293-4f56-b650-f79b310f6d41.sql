
-- Revoke public/anon EXECUTE on all SECURITY DEFINER functions in the public schema.
-- Grant back to authenticated + service_role so RLS policies, triggers, and edge
-- functions keep working. Anonymous callers can no longer invoke them directly.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name,
           p.proname  AS fn_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
      fn.schema_name, fn.fn_name, fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;',
      fn.schema_name, fn.fn_name, fn.args
    );
  END LOOP;
END
$$;
