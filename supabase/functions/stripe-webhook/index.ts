import Stripe from "npm:stripe@22.6.2";
import { adminClient } from "../_shared/billing-auth.ts";
import { getBillingEnvironment, getStripe, resolveStripePlan } from "../_shared/stripe.ts";

// Stripe → FastTract subscription rows. Signed with STRIPE_WEBHOOK_SECRET; public (verify_jwt = false).
// Subscribe the endpoint to customer.subscription.created / .updated / .deleted.
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const HANDLED = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

function iso(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) return new Response("Webhook is not configured", { status: 503 });

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(await req.text(), signature, webhookSecret, undefined, cryptoProvider);
  } catch (error) {
    console.error("stripe-webhook signature check failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!HANDLED.has(event.type)) return Response.json({ received: true, ignored: event.type });

  try {
    const subscription = event.data.object as Stripe.Subscription;
    const item = subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number };
    const plan = item ? resolveStripePlan(item.price.id) : null;
    const userId = subscription.metadata?.userId;
    const organizationId = subscription.metadata?.orgId;
    if (!plan || !userId || !organizationId) {
      // Not one of ours (or created by hand in the dashboard without metadata). Acknowledge so Stripe stops retrying.
      console.error("Stripe subscription has no recognized FastTract plan/metadata", { event: event.id, subscription: subscription.id });
      return Response.json({ received: true, ignored: "unrecognized_subscription" });
    }

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;
    const admin = adminClient();
    const { error } = await admin.from("subscriptions").upsert({
      user_id: userId,
      organization_id: organizationId,
      billing_provider: "stripe",
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      product_id: plan.productId,
      price_id: plan.priceId,
      status,
      current_period_start: iso(item?.current_period_start),
      current_period_end: iso(item?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      environment: getBillingEnvironment(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id" });
    if (error) throw error;

    // Keep the business's plan label in step for admin screens.
    await admin.from("organizations").update({ plan: ["active", "trialing", "past_due"].includes(status) ? plan.tier : null }).eq("id", organizationId);
    return Response.json({ received: true });
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a database hiccup.
    console.error("stripe-webhook processing error", error);
    return new Response("Processing error", { status: 500 });
  }
});
