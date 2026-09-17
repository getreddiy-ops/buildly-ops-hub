import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(payload: string, signatureHeader: string, secret: string) {
  const fields = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = fields.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = hex(digest);
  return signatures.some((candidate) => constantTimeEqual(candidate, expected));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!STRIPE_WEBHOOK_SECRET) return new Response("Webhook secret is not configured", { status: 503 });

  const payload = await req.text();
  const signature = req.headers.get("Stripe-Signature") ?? "";
  if (!(await verifySignature(payload, signature, STRIPE_WEBHOOK_SECRET))) {
    return new Response("Invalid Stripe signature", { status: 400 });
  }

  try {
    const event = JSON.parse(payload);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (event.type === "account.updated") {
      const account = event.data?.object ?? {};
      if (account.id) {
        await admin
          .from("organizations")
          .update({
            stripe_connect_status: account.charges_enabled === true ? "ready" : account.details_submitted === true ? "pending" : "onboarding",
            stripe_charges_enabled: account.charges_enabled === true,
            stripe_payouts_enabled: account.payouts_enabled === true,
            stripe_details_submitted: account.details_submitted === true,
          })
          .eq("stripe_connected_account_id", account.id);
      }
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data?.object ?? {};
      const metadata = session.metadata ?? {};
      if (metadata.purpose === "estimate_deposit" && session.payment_status === "paid") {
        const estimateId = String(metadata.estimate_id ?? "");
        const organizationId = String(metadata.organization_id ?? "");
        const connectedAccountId = String(event.account ?? "");
        if (estimateId && organizationId && connectedAccountId) {
          const { data: organization } = await admin
            .from("organizations")
            .select("stripe_connected_account_id")
            .eq("id", organizationId)
            .maybeSingle();

          if (organization?.stripe_connected_account_id === connectedAccountId) {
            const amount = Number(session.amount_total ?? 0) / 100;
            const now = new Date().toISOString();
            await admin
              .from("estimates")
              .update({
                deposit_collected: true,
                deposit_collected_at: now,
                deposit_checkout_session_id: session.id ?? null,
                deposit_payment_intent_id: session.payment_intent ?? null,
                deposit_amount_collected: amount,
              })
              .eq("id", estimateId)
              .eq("organization_id", organizationId);

            await admin.from("ft_payments").upsert({
              id: String(session.payment_intent ?? session.id),
              business_id: organizationId,
              data: {
                provider: "stripe",
                type: "estimate_deposit",
                status: "paid",
                estimate_id: estimateId,
                amount,
                currency: session.currency ?? "usd",
                checkout_session_id: session.id ?? null,
                payment_intent_id: session.payment_intent ?? null,
                connected_account_id: connectedAccountId,
                paid_at: now,
              },
            }, { onConflict: "id" });
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stripe-connect-webhook error", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
});
