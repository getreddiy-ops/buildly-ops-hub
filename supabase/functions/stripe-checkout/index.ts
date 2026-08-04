// Creates an authenticated Stripe Checkout Session for the caller's active org.
// Owners only. Returns { url } for the browser to redirect to.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getStripe,
  priceIdForTier,
  stripeEnvironment,
  subscriptionIsActive,
} from "../_shared/stripe.ts";
import {
  resolveAppOrigin,
  checkoutSuccessUrl,
  checkoutCancelUrl,
} from "../_shared/app-origin.ts";

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
    if (!plan || !organizationId) return json(400, { error: "plan and organizationId are required" });

    let resolved;
    try {
      resolved = priceIdForTier(plan);
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

    const stripe = getStripe();
    const env = stripeEnvironment();

    // Never open a second checkout for an org that already has a live subscription —
    // Stripe would happily bill twice. Plan switches go through stripe-change-plan.
    const { data: currentSub } = await admin
      .from("subscriptions")
      .select("status,current_period_end,stripe_subscription_id,provider")
      .eq("organization_id", organizationId)
      .not("stripe_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentSub && subscriptionIsActive(currentSub as any)) {
      return json(409, {
        error: "This organization already has an active subscription. Change plans instead.",
        code: "already_subscribed",
      });
    }

    // Reuse an existing Stripe customer for this org (also tracks trial usage).
    const { data: existing } = await admin
      .from("billing_customers")
      .select("stripe_customer_id, trial_used")
      .eq("organization_id", organizationId)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id, organizationId },
      });
      customerId = customer.id;
      await admin.from("billing_customers").upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          stripe_customer_id: customerId,
          environment: env,
        },
        { onConflict: "organization_id" },
      );
    }

    // Trial abuse prevention: one trial per owner, across every org they own.
    let trialUsed = existing?.trial_used === true;
    if (!trialUsed) {
      const { data: priorTrials } = await admin
        .from("billing_customers")
        .select("trial_used")
        .eq("user_id", user.id)
        .eq("trial_used", true)
        .limit(1);
      trialUsed = !!priorTrials?.length;
    }

    const base = resolveAppOrigin(req, Deno.env.get("PUBLIC_APP_URL"));
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: resolved.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: organizationId,
      subscription_data: {
        ...(trialUsed ? {} : { trial_period_days: 7 }),
        metadata: { userId: user.id, organizationId, plan: resolved.tier },
      },
      metadata: { userId: user.id, organizationId, plan: resolved.tier },
      success_url: checkoutSuccessUrl(base),
      cancel_url: checkoutCancelUrl(base),
    });

    return json(200, { url: session.url, id: session.id, trial: !trialUsed });
  } catch (e) {
    console.error("stripe-checkout error:", e);
    return json(500, { error: (e as Error).message });
  }
});
