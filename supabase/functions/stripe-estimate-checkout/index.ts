import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_URL = Deno.env.get("FASTTRACT_APP_URL") || "https://fasttract-app.vercel.app";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function createCheckoutSession(accountId: string, params: URLSearchParams) {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe payments are not configured yet");
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Stripe-Account": accountId,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error?.message ?? `Stripe checkout failed (${response.status})`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const token = String(body.token ?? "").trim();
    if (!token) return json({ error: "Estimate token is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: estimate, error: estimateError } = await admin
      .from("estimates")
      .select("id,organization_id,customer_id,title,status,total,share_token,accepted_at,deposit_required,deposit_collected")
      .eq("share_token", token)
      .maybeSingle();
    if (estimateError) throw estimateError;
    if (!estimate) return json({ error: "Estimate not found" }, 404);
    if (!estimate.accepted_at || estimate.status !== "approved") {
      return json({ error: "Accept the estimate before paying the deposit" }, 409);
    }
    if (estimate.deposit_collected) return json({ error: "Deposit is already paid" }, 409);

    const deposit = Number(estimate.deposit_required ?? 0);
    if (!Number.isFinite(deposit) || deposit <= 0) return json({ error: "No deposit is required for this estimate" }, 409);

    const { data: organization, error: orgError } = await admin
      .from("organizations")
      .select("name,stripe_connected_account_id,stripe_charges_enabled")
      .eq("id", estimate.organization_id)
      .single();
    if (orgError) throw orgError;
    if (!organization.stripe_connected_account_id || !organization.stripe_charges_enabled) {
      return json({ error: "Online payments are not enabled for this contractor yet" }, 409);
    }

    let customerEmail: string | null = null;
    if (estimate.customer_id) {
      const { data: customer } = await admin
        .from("customers")
        .select("email")
        .eq("id", estimate.customer_id)
        .eq("organization_id", estimate.organization_id)
        .maybeSingle();
      customerEmail = customer?.email ?? null;
    }

    const amountCents = Math.round(deposit * 100);
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${APP_URL}/e/${encodeURIComponent(token)}?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${APP_URL}/e/${encodeURIComponent(token)}?payment=cancelled`);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(amountCents));
    params.set("line_items[0][price_data][product_data][name]", `Deposit — ${estimate.title}`);
    params.set("metadata[estimate_id]", estimate.id);
    params.set("metadata[organization_id]", estimate.organization_id);
    params.set("metadata[purpose]", "estimate_deposit");
    params.set("payment_intent_data[metadata][estimate_id]", estimate.id);
    params.set("payment_intent_data[metadata][organization_id]", estimate.organization_id);
    params.set("payment_intent_data[metadata][purpose]", "estimate_deposit");
    if (customerEmail) params.set("customer_email", customerEmail);

    const session = await createCheckoutSession(organization.stripe_connected_account_id, params);
    if (!session.url || !session.id) throw new Error("Stripe did not return a checkout URL");

    const { error: saveError } = await admin
      .from("estimates")
      .update({ deposit_checkout_session_id: session.id })
      .eq("id", estimate.id);
    if (saveError) throw saveError;

    return json({ url: session.url, sessionId: session.id, amount: deposit });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("stripe-estimate-checkout error", error);
    return json({ error: message }, 400);
  }
});
