// In-app plan switching. Upgrades apply immediately with proration and an
// invoice now; downgrades are scheduled for the end of the current period.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getStripe,
  priceIdForTier,
  subscriptionIsActive,
  tierFromStripePrice,
  TIER_ORDER,
} from "../_shared/stripe.ts";
import { syncSubscription } from "../_shared/stripe-sync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const { plan, organizationId } = body as { plan?: string; organizationId?: string };
    if (!plan || !organizationId) {
      return json(400, { error: "plan and organizationId are required" });
    }

    let target;
    try {
      target = priceIdForTier(plan);
    } catch (e) {
      return json(400, { error: (e as Error).message });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json(401, { error: "Unauthorized" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership || membership.role !== "owner") {
      return json(403, { error: "Only the organization owner can manage billing" });
    }

    const { data: row } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id,status,current_period_end")
      .eq("organization_id", organizationId)
      .not("stripe_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || !subscriptionIsActive(row as any)) {
      return json(409, { error: "No active subscription to change", code: "no_subscription" });
    }

    const stripe = getStripe();
    const subId = row.stripe_subscription_id as string;
    const sub = await stripe.subscriptions.retrieve(subId);
    const item = sub.items.data[0];
    const currentPriceId = item?.price?.id ?? null;
    if (currentPriceId === target.priceId) {
      return json(200, { ok: true, unchanged: true });
    }

    const currentTier = tierFromStripePrice(currentPriceId);
    const isUpgrade =
      !currentTier || TIER_ORDER.indexOf(target.tier) > TIER_ORDER.indexOf(currentTier);

    // Any previously scheduled downgrade is replaced by this request.
    const existingSchedule =
      typeof sub.schedule === "string" ? sub.schedule : (sub.schedule as any)?.id ?? null;

    if (isUpgrade) {
      if (existingSchedule) {
        await stripe.subscriptionSchedules.release(existingSchedule).catch(() => {});
      }
      const updated = await stripe.subscriptions.update(subId, {
        items: [{ id: item.id, price: target.priceId, quantity: 1 }],
        proration_behavior: sub.status === "trialing" ? "none" : "always_invoice",
        payment_behavior: "error_if_incomplete",
        metadata: { ...(sub.metadata ?? {}), plan: target.tier },
      });
      await syncSubscription(updated as any);
      return json(200, { ok: true, effective: "now", plan: target.tier });
    }

    // Downgrade: keep the paid-for tier until the period ends, then switch.
    let scheduleId = existingSchedule;
    if (!scheduleId) {
      const created = await stripe.subscriptionSchedules.create({ from_subscription: subId });
      scheduleId = created.id;
    }
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const phase = schedule.phases[0];
    const updatedSchedule = await stripe.subscriptionSchedules.update(scheduleId, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: currentPriceId!, quantity: 1 }],
          start_date: phase.start_date,
          end_date: phase.end_date,
          proration_behavior: "none",
        },
        {
          items: [{ price: target.priceId, quantity: 1 }],
          proration_behavior: "none",
          metadata: { plan: target.tier },
        },
      ],
      metadata: { ...(sub.metadata ?? {}), scheduled_plan: target.tier },
    });

    const refreshed = await stripe.subscriptions.retrieve(subId, { expand: ["schedule"] });
    await syncSubscription(refreshed as any);

    return json(200, {
      ok: true,
      effective: "period_end",
      plan: target.tier,
      effective_at: updatedSchedule.phases[1]?.start_date
        ? new Date(updatedSchedule.phases[1].start_date * 1000).toISOString()
        : null,
    });
  } catch (e) {
    console.error("stripe-change-plan error:", e);
    return json(500, { error: (e as Error).message });
  }
});
