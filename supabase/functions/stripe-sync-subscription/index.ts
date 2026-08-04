// On-demand reconciliation right after checkout: if the webhook hasn't landed
// yet (or was missed), the browser can ask us to pull the truth from Stripe.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripe } from "../_shared/stripe.ts";
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
    const { organizationId, sessionId } = body as {
      organizationId?: string;
      sessionId?: string;
    };
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
    if (!membership) return json(403, { error: "Forbidden" });

    const stripe = getStripe();

    // Preferred path: the checkout session we just returned from.
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id && session.client_reference_id !== organizationId) {
        return json(403, { error: "Forbidden" });
      }
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const meta = (session.metadata ?? {}) as Record<string, string>;
        if (meta.organizationId && !sub.metadata?.organizationId) {
          await stripe.subscriptions.update(subId, { metadata: meta });
          (sub as any).metadata = meta;
        }
        const row = await syncSubscription(sub as any, session.payment_status ?? undefined);
        return json(200, { synced: !!row, status: (sub as any).status });
      }
    }

    // Fallback: reconcile whatever Stripe has for this org's customer.
    const { data: bc } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!bc?.stripe_customer_id) return json(200, { synced: false });

    const list = await stripe.subscriptions.list({
      customer: bc.stripe_customer_id as string,
      status: "all",
      limit: 5,
    });
    let synced = 0;
    for (const sub of list.data) {
      if (await syncSubscription(sub as any)) synced++;
    }
    return json(200, { synced: synced > 0, count: synced });
  } catch (e) {
    console.error("stripe-sync-subscription error:", e);
    return json(500, { error: (e as Error).message });
  }
});
