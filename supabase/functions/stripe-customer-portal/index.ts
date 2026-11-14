import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { appUrl, json, requireOrgOwner } from "../_shared/billing-auth.ts";
import { getBillingEnvironment, getStripe } from "../_shared/stripe.ts";

// Opens the Stripe customer portal (card, invoices, plan change, cancel). Owner-only.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { organizationId } = await req.json();
    if (!organizationId) return json(400, { error: "organizationId is required" });

    const auth = await requireOrgOwner(req, organizationId);
    if (!auth.ok) return auth.response;

    const { data: subscription } = await auth.admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .eq("environment", getBillingEnvironment())
      .eq("billing_provider", "stripe")
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!subscription?.stripe_customer_id) return json(404, { error: "No Stripe subscription found for this business" });

    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl()}/app/billing`,
    });
    return json(200, { url: portal.url });
  } catch (error) {
    console.error("stripe-customer-portal error", error);
    return json(500, { error: (error as Error).message });
  }
});
