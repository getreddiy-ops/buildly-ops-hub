import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native";

async function openFunctionUrl(fn: "create-stripe-checkout" | "stripe-customer-portal", body: Record<string, string>) {
  if (isNativeApp()) throw new Error("Manage your FastTract plan from fasttract.org in a web browser.");
  const { data, error } = await supabase.functions.invoke(fn, { body });
  const url = (data as { url?: string } | null)?.url;
  if (error || !url) throw new Error((data as { error?: string } | null)?.error || error?.message || "Could not reach billing");
  window.location.assign(url);
}

/** Stripe Checkout and customer portal, both owner-only on the server. */
export function useStripeBilling() {
  const [loading, setLoading] = useState<null | "checkout" | "portal">(null);
  const run = async (kind: "checkout" | "portal", fn: () => Promise<void>) => {
    setLoading(kind);
    try { await fn(); } finally { setLoading(null); }
  };
  return {
    loading,
    startCheckout: (organizationId: string, priceId: string) =>
      run("checkout", () => openFunctionUrl("create-stripe-checkout", { organizationId, priceId })),
    openPortal: (organizationId: string) =>
      run("portal", () => openFunctionUrl("stripe-customer-portal", { organizationId })),
  };
}
