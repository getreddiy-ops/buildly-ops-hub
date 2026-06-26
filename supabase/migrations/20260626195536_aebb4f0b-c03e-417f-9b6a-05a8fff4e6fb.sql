
-- 1. SECURITY DEFINER fn anon-executable: get_org_hourly_rates
REVOKE EXECUTE ON FUNCTION public.get_org_hourly_rates(uuid) FROM PUBLIC, anon;

-- 2. Invitations token_hash exposure
REVOKE SELECT (token_hash) ON public.invitations FROM anon, authenticated;

-- 3. organization_members.hourly_rate exposure
REVOKE SELECT (hourly_rate) ON public.organization_members FROM anon, authenticated;

-- 4. Subscriptions paddle billing ID exposure (keep price_id/product_id for entitlement)
REVOKE SELECT (paddle_customer_id, paddle_subscription_id) ON public.subscriptions FROM anon, authenticated;

-- 5. Branding storage: restrict writes to org admins
DROP POLICY IF EXISTS "branding write org members" ON storage.objects;
DROP POLICY IF EXISTS "branding update org members" ON storage.objects;
DROP POLICY IF EXISTS "branding delete org members" ON storage.objects;

CREATE POLICY "branding write org admins"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "branding update org admins"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'branding'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "branding delete org admins"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
