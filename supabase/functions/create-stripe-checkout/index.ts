import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { appUrl, json, requireOrgOwner } from "../_shared/billing-auth.ts";
import { getBillingEnvironment, getStripe, resolveInternalPlan } from "../_shared/stripe.ts";
import { TRIAL_DAYS } from "../_shared/plans.ts";

// Starts Stripe Checkout for a FastTract plan. Owner-only; one live subscription per business.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { organizationId, priceId } = await req.json();
    if (!organizationId || !priceId) return json(400, { error: "organizationId and priceId are required" });

    const auth = await requireOrgOwner(req, organizationId);
    if (!auth.ok) return auth.response;
    const { user, admin } = auth;

    const environment = getBillingEnvironment();
    const { data: current } = await admin
      .from("subscriptions")
      .select("id, billing_provider, status")
      .eq("organization_id", organizationId)
      .eq("environment", environment)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();
    if (current) {
      return json(409, { error: "This business already has an active FastTract plan. Manage it from Plan & billing." });
    }

    // A business that already had a trial (any provider, any status) does not get a second one.
    const { count: priorCount } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("environment", environment)
      .neq("billing_provider", "internal");

    const plan = resolveInternalPlan(priceId);
    const metadata = { userId: user.id, orgId: organizationId, internalPriceId: plan.priceId };
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: user.email!,
      client_reference_id: organizationId,
      metadata,
      subscription_data: {
        ...(priorCount ? {} : { trial_period_days: TRIAL_DAYS }),
        metadata,
      },
      payment_method_collection: "always",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${appUrl()}/app/billing?checkout=success`,
      cancel_url: `${appUrl()}/app/billing?checkout=canceled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return json(200, { url: session.url });
  } catch (error) {
    console.error("create-stripe-checkout error", error);
    return json(500, { error: (error as Error).message });
  }
});
