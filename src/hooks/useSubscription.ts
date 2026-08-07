import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { tierFromPriceId, hasAssistant, hasPhoneAssistant } from "@/lib/tiers";

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
  scheduled_price_id: string | null;
  scheduled_change_at: string | null;
  environment: string;
  provider: string | null;
  trial_end: string | null;
  payment_status: string | null;
  comped: boolean | null;
  comp_note: string | null;
  created_at: string;
};

/**
 * Org-scoped subscription state. Any member of the active org sees the org's
 * subscription. The owner is the one who can purchase / manage it.
 *
 * Note: rows are NOT filtered by environment. There is a single Stripe account
 * behind the app, and filtering caused test-mode purchases to be invisible.
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
        "id,user_id,organization_id,product_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,scheduled_price_id,scheduled_change_at,environment,provider,trial_end,payment_status,comped,comp_note,created_at",
      )
      .eq("organization_id", orgId)
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

  const now = Date.now();
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : null;
  const isComped = !!subscription?.comped;
  const isActive =
    isComped ||
    (!!subscription &&
    ((["active", "trialing", "past_due"].includes(subscription.status) &&
      (!periodEnd || periodEnd > now)) ||
      (subscription.status === "canceled" && !!periodEnd && periodEnd > now)));
  const isPastDue = subscription?.status === "past_due";
  const isTrialing = subscription?.status === "trialing";
  const isOwner = activeOrg?.role === "owner";
  const tier = isActive ? tierFromPriceId(subscription?.price_id) : null;
  const scheduledTier = tierFromPriceId(subscription?.scheduled_price_id);
  const canUseAssistant = hasAssistant(tier);
  const canUsePhoneAssistant = hasPhoneAssistant(tier);

  return {
    subscription,
    isActive,
    isComped,
    isPastDue,
    isTrialing,
    isOwner,
    tier,
    scheduledTier,
    canUseAssistant,
    canUsePhoneAssistant,
    loading,
    refetch: fetchSub,
  };
}
