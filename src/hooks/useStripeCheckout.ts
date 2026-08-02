import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tier } from "@/lib/tiers";

/**
 * Opens a Stripe Checkout Session created by the authenticated
 * `stripe-checkout` Edge Function. Secret keys never reach the browser.
 */
export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);

  const openCheckout = async ({
    plan,
    organizationId,
  }: {
    plan: Tier;
    organizationId: string;
  }) => {
    setLoading(true);
    setPendingTier(plan);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan, organizationId },
      });
      let message = error?.message;
      const context = (error as any)?.context;
      if (context instanceof Response) {
        try {
          const body = await context.clone().json();
          message = body?.error ?? message;
        } catch {
          /* non-JSON error body */
        }
      }
      if (error || !data?.url) {
        throw new Error(message ?? data?.error ?? "Could not start checkout");
      }
      window.location.assign(data.url as string);
      return data.url as string;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not open checkout. Please try again.";
      toast.error(message);
      console.error("[useStripeCheckout] failed:", err);
      throw err;
    } finally {
      setLoading(false);
      setPendingTier(null);
    }
  };

  return { openCheckout, loading, pendingTier };
}
