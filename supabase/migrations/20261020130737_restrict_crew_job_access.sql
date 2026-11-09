-- Preserve existing membership reads; limit business writes to owners/admins.
-- Time clock entries keep their existing own-user insert/update policies.
do $policy$
declare
  target text;
  parent text;
  foreign_key text;
  condition text;
begin
  foreach target in array array['customers','estimates','org_jobs','org_invoices','contracts','materials','vendors','phone_assistants'] loop
    condition := 'public.is_org_admin((select auth.uid()), organization_id)';
    execute format('create policy crew_no_business_insert on public.%I as restrictive for insert to authenticated with check (%s)', target, condition);
    execute format('create policy crew_no_business_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)', target, condition, condition);
    execute format('create policy crew_no_business_delete on public.%I as restrictive for delete to authenticated using (%s)', target, condition);
  end loop;
  for target, parent, foreign_key in values
    ('org_crew_assignments','org_jobs','job_id'),
    ('org_job_costs','org_jobs','job_id'),
    ('estimate_line_items','estimates','estimate_id'),
    ('org_invoice_line_items','org_invoices','invoice_id')
  loop
    condition := format('exists (select 1 from public.%I parent where parent.id = %I.%I and public.is_org_admin((select auth.uid()), parent.organization_id))', parent, target, foreign_key);
    execute format('create policy crew_no_business_insert on public.%I as restrictive for insert to authenticated with check (%s)', target, condition);
    execute format('create policy crew_no_business_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)', target, condition, condition);
    execute format('create policy crew_no_business_delete on public.%I as restrictive for delete to authenticated using (%s)', target, condition);
  end loop;
end
$policy$;
