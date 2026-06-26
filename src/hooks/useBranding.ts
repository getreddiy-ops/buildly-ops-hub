import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DocumentTemplate {
  header?: string;
  footer?: string;
  terms?: string;
  notes?: string;
}

export interface DocumentDefaults {
  estimate?: DocumentTemplate;
  invoice?: DocumentTemplate;
  contract?: DocumentTemplate;
}

export interface Branding {
  id: string;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  logo_signed_url: string | null;
  brand_color: string | null;
  brand_color_secondary: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  document_defaults: DocumentDefaults;
}

async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("branding").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useBranding() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id;
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setBranding(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("id,name,legal_name,logo_url,brand_color,brand_color_secondary,address,phone,email,website,document_defaults")
      .eq("id", orgId)
      .maybeSingle();
    if (data) {
      const signed = await signLogo(data.logo_url);
      // tax_id is admin-only; fetch via RPC (returns null for non-admins).
      const { data: taxId } = await supabase.rpc("get_org_tax_id", { _org_id: orgId });
      setBranding({
        ...data,
        tax_id: (taxId as string | null) ?? null,
        document_defaults: (data.document_defaults ?? {}) as DocumentDefaults,
        logo_signed_url: signed,
      });
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  return { branding, loading, refresh: load };
}
