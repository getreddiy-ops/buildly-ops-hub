import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AiConnection = {
  provider: "openai" | "anthropic" | "google";
  model: string;
  key_last4: string;
  status: "connected" | "failing";
  last_error: string | null;
  verified_at: string | null;
};

/** The active business's bring-your-own AI connection (never the key itself). */
export function useAiConnection() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id ?? null;
  const [connection, setConnection] = useState<AiConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!orgId) { setConnection(null); setLoading(false); return; }
    // Table added by the bring-your-own AI migration; typed loosely until types are regenerated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("org_ai_connections")
      .select("provider,model,key_last4,status,last_error,verified_at")
      .eq("organization_id", orgId)
      .maybeSingle();
    setConnection((data as AiConnection | null) ?? null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { setLoading(true); void refetch(); }, [refetch]);
  return { connection, loading, refetch, orgId };
}
