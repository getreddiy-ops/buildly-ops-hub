import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBillingEnvironment, getStripe, resolveInternalPlan } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
    const { organizationId, priceId } = await req.json();
    if (!organizationId || !priceId) return json(400, { error: "organizationId and priceId are required" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user?.email) return json(401, { error: "Unauthorized" });

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
      return json(403, { error: "Only the organization owner can subscribe" });
    }

    const environment = getBillingEnvironment();
    const { data: activeSubscription } = await admin
      .from("subscriptions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("environment", environment)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();
    if (activeSubscription) {
      return json(409, { error: "This organization already has an active subscription. Manage it from Billing." });
    }

    const plan = resolveInternalPlan(priceId);
    const stripe = getStripe();
    const metadata = {
      userId: user.id,
      orgId: organizationId,
      internalPriceId: plan.priceId,
      internalProductId: plan.productId,
    };
    const appOrigin = Deno.env.get("PUBLIC_APP_URL") || "https://fasttract.org";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: organizationId,
      metadata,
      subscription_data: {
        trial_period_days: 7,
        metadata,
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${appOrigin}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/app/billing?checkout=canceled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return json(200, { url: session.url });
  } catch (error) {
    console.error("create-stripe-checkout error", error);
    return json(500, { error: (error as Error).message });
  }
});
