import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIME_ENTRY_TABLE } from "@/lib/time-clock";
import type { SetupFacts } from "@/lib/setup-guide";

type CountTable = "materials" | "customers" | "estimates" | "org_jobs" | "invitations" | "org_invoices" | typeof TIME_ENTRY_TABLE;

/** Reads just enough of the business's data to tell which setup steps are done. */
export function useSetupFacts(orgId: string | undefined) {
  const [facts, setFacts] = useState<SetupFacts | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const count = async (table: CountTable) => {
      const { count: n } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
      return n ?? 0;
    };
    (async () => {
      const [org, materials, customers, estimates, jobs, crewInvites, timeEntries, invoices] = await Promise.all([
        supabase.from("organizations").select("name, phone, address, logo_url, stripe_charges_enabled").eq("id", orgId).maybeSingle(),
        count("materials"), count("customers"), count("estimates"), count("org_jobs"),
        count("invitations"), count(TIME_ENTRY_TABLE), count("org_invoices"),
      ]);
      if (cancelled) return;
      const o = org.data;
      setFacts({
        hasProfile: !!(o?.name && o.phone && o.address),
        hasLogo: !!o?.logo_url,
        materials, customers, estimates, jobs, crewInvites, timeEntries, invoices,
        cardPayments: !!o?.stripe_charges_enabled,
      });
    })().catch(() => { if (!cancelled) setFacts(null); });
    return () => { cancelled = true; };
  }, [orgId]);

  return facts;
}
