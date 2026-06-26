// Creates a Paddle-hosted customer portal session for the caller's active org.
// Owners only. Returns the overview URL to open in a new tab.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaddleClient, type PaddleEnv } from "../_shared/paddle.ts";

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

    const { organizationId, environment } = await req.json();
    if (!organizationId || !["sandbox", "live"].includes(environment)) {
      return json(400, { error: "organizationId and environment required" });
    }

    // User-scoped client to identify caller and respect RLS
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

    // Owner-only
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership || membership.role !== "owner") {
      return json(403, { error: "Only the organization owner can manage billing" });
    }

    // Most recent subscription for this org+env
    const { data: sub } = await admin
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("organization_id", organizationId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return json(404, { error: "No subscription found" });

    const paddle = getPaddleClient(environment as PaddleEnv);
    const portal = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      [sub.paddle_subscription_id],
    );

    return json(200, {
      url: portal.urls.general.overview,
      subscriptionUrls: portal.urls.subscriptions,
    });
  } catch (e) {
    console.error("paddle-customer-portal error:", e);
    return json(500, { error: String((e as Error).message) });
  }
});
