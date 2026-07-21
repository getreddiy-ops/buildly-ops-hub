import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPaddleEnvironment } from "@/lib/paddle";
import { tierFromPriceId, hasAssistant, hasPhoneAssistant } from "@/lib/tiers";
import { hasSubscriptionAccess } from "@/lib/subscription-access";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
};

/**
 * Org-scoped subscription state. Any member of the active org sees the org's
 * Pro subscription. The owner is the one who can actually purchase / manage it.
 */
export function useSubscription() {
  const { user, activeOrg } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const orgId = activeOrg?.organization_id ?? null;

  const fetchSub = useCallback(async () => {
    if (!user || !orgId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "id,user_id,organization_id,product_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,environment,created_at",
      )
      .eq("organization_id", orgId)
      .eq("environment", getPaddleEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as unknown as SubscriptionRow | null) ?? null);
    setLoading(false);
  }, [user, orgId]);

  useEffect(() => {
    setLoading(true);
    fetchSub();
  }, [fetchSub]);

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase.channel(`subs:org:${orgId}:${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `organization_id=eq.${orgId}` },
        () => fetchSub(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, fetchSub]);

  const isActive = hasSubscriptionAccess(subscription);
  const isPastDue = subscription?.status === "past_due";
  const isOwner = activeOrg?.role === "owner";
  const tier = isActive ? tierFromPriceId(subscription?.price_id) : null;
  const canUseAssistant = hasAssistant(tier);
  const canUsePhoneAssistant = hasPhoneAssistant(tier);

  return {
    subscription,
    isActive,
    isPastDue,
    isOwner,
    tier,
    canUseAssistant,
    canUsePhoneAssistant,
    loading,
    refetch: fetchSub,
  };
}
