// Shared Stripe -> public.subscriptions sync. Used by stripe-webhook (event driven)
// and stripe-sync-subscription (on-demand fallback right after checkout).
import { createClient } from "npm:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@17";
import {
  stripeEnvironment,
  tierFromStripePrice,
  TIER_LOGICAL_PRICE,
  TIER_LOGICAL_PRODUCT,
} from "./stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
export function admin() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

export const ts = (secs: number | null | undefined) =>
  secs ? new Date(secs * 1000).toISOString() : null;

/** Upserts a Stripe subscription into public.subscriptions. Returns the row or null. */
export async function syncSubscription(
  sub: Stripe.Subscription,
  paymentStatus?: string,
): Promise<Record<string, unknown> | null> {
  const env = stripeEnvironment();
  const item = sub.items.data[0];
  const stripePriceId = item?.price?.id ?? null;
  const tier = tierFromStripePrice(stripePriceId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  const meta = (sub.metadata ?? {}) as Record<string, string>;
  let userId = meta.userId || null;
  let organizationId = meta.organizationId || null;

  if (!organizationId && customerId) {
    const { data: bc } = await admin()
      .from("billing_customers")
      .select("organization_id, user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    organizationId = (bc?.organization_id as string) ?? null;
    userId = userId ?? ((bc?.user_id as string) ?? null);
  }
  if (!userId && organizationId) {
    const { data: owner } = await admin()
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner")
      .maybeSingle();
    userId = (owner?.user_id as string) ?? null;
  }
  if (!userId) {
    console.error("stripe-sync: cannot resolve user for subscription", sub.id);
    return null;
  }

  // A scheduled downgrade shows up as a subscription schedule with a future phase.
  let scheduledPriceId: string | null = null;
  let scheduledChangeAt: string | null = null;
  const schedule = (sub as any).schedule;
  if (schedule && typeof schedule === "object" && Array.isArray(schedule.phases)) {
    const nowSecs = Math.floor(Date.now() / 1000);
    const next = schedule.phases.find((p: any) => p.start_date > nowSecs);
    if (next) {
      const nextPrice = next.items?.[0]?.price;
      const rawId = typeof nextPrice === "string" ? nextPrice : nextPrice?.id ?? null;
      const scheduledTier = tierFromStripePrice(rawId);
      // Store the logical price id so the frontend tier map can read it.
      scheduledPriceId = scheduledTier ? TIER_LOGICAL_PRICE[scheduledTier] : rawId;
      scheduledChangeAt = ts(next.start_date);
    }
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    organization_id: organizationId,
    provider: "stripe",
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId ?? null,
    stripe_price_id: stripePriceId,
    price_id: tier ? TIER_LOGICAL_PRICE[tier] : (stripePriceId ?? "unknown"),
    product_id: tier ? TIER_LOGICAL_PRODUCT[tier] : null,
    status: sub.status,
    current_period_start: ts((sub as any).current_period_start ?? item?.current_period_start),
    current_period_end: ts((sub as any).current_period_end ?? item?.current_period_end),
    trial_end: ts(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    scheduled_price_id: scheduledPriceId,
    scheduled_change_at: scheduledChangeAt,
    environment: env,
    updated_at: new Date().toISOString(),
  };
  if (paymentStatus) row.payment_status = paymentStatus;

  const { error } = await admin()
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) {
    console.error("stripe-sync upsert failed:", error);
    return null;
  }

  // Mark the trial as consumed so a repeat checkout cannot grant another one.
  if (sub.trial_end) {
    if (organizationId) {
      await admin()
        .from("billing_customers")
        .update({ trial_used: true })
        .eq("organization_id", organizationId);
    }
    // Also burn the trial for every org this user owns a billing account for.
    await admin().from("billing_customers").update({ trial_used: true }).eq("user_id", userId);
  }

  // Keep organizations.plan roughly in step for admin views.
  if (organizationId && tier) {
    await admin().from("organizations").update({ plan: tier }).eq("id", organizationId);
  }

  return row;
}
