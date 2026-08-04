// Creates a Stripe Billing Portal session for the caller's active org. Owners only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripe } from "../_shared/stripe.ts";
import { resolveAppOrigin, billingPortalReturnUrl } from "../_shared/app-origin.ts";

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

    const { organizationId } = await req.json().catch(() => ({}));
    if (!organizationId) return json(400, { error: "organizationId is required" });

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

    let customerId: string | null = null;
    const { data: bc } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    customerId = (bc?.stripe_customer_id as string) ?? null;

    if (!customerId) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("organization_id", organizationId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      customerId = (sub?.stripe_customer_id as string) ?? null;
    }
    if (!customerId) return json(404, { error: "No billing account found for this organization" });

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: billingPortalReturnUrl(resolveAppOrigin(req, Deno.env.get("PUBLIC_APP_URL"))),
    });

    return json(200, { url: session.url });
  } catch (e) {
    console.error("stripe-portal error:", e);
    return json(500, { error: (e as Error).message });
  }
});
