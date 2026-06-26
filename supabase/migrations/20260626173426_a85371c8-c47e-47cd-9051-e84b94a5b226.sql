
-- Restrict token_hash column on invitations
REVOKE SELECT (token_hash) ON public.invitations FROM authenticated, anon, PUBLIC;

-- Tighten branding bucket SELECT to org members
DROP POLICY IF EXISTS "branding read auth" ON storage.objects;
CREATE POLICY "branding read org members"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'branding'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
