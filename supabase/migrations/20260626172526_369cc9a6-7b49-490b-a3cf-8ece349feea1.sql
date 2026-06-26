
create policy "branding read auth" on storage.objects for select to authenticated
  using (bucket_id = 'branding');

create policy "branding write org members" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

create policy "branding update org members" on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

create policy "branding delete org members" on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
