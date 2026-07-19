import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    organizationId: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
        body: options,
      });
      if (error || !data?.url) throw new Error(data?.error || error?.message || "Could not create checkout");
      window.location.assign(data.url);
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
