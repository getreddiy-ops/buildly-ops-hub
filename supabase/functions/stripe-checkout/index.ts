// Creates an authenticated Stripe Checkout Session for the caller's active org.
// Owners only. Returns { url } for the browser to redirect to.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getStripe,
  priceIdForTier,
  appUrl,
  stripeEnvironment,
} from "../_shared/stripe.ts";

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

    // Trial abuse prevention: only grant a trial if this org has never had one.
    const trialUsed = existing?.trial_used === true;

    const base = appUrl();
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
      success_url: `${base}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/app/billing?checkout=cancelled`,
    });

    return json(200, { url: session.url, id: session.id });
  } catch (e) {
    console.error("stripe-checkout error:", e);
    return json(500, { error: (e as Error).message });
  }
});
