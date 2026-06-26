
-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendors_org_idx ON public.vendors(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors read by org members"
  ON public.vendors FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "vendors write by org admins"
  ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "vendors update by org admins"
  ON public.vendors FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "vendors delete by org admins"
  ON public.vendors FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MATERIALS
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  category text,
  unit text NOT NULL DEFAULT 'ea',
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX materials_org_idx ON public.materials(organization_id);
CREATE INDEX materials_vendor_idx ON public.materials(vendor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials read by org members"
  ON public.materials FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "materials write by org admins"
  ON public.materials FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "materials update by org admins"
  ON public.materials FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "materials delete by org admins"
  ON public.materials FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
