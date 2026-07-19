import Stripe from "npm:stripe@^22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBillingEnvironment, getStripe, resolveStripePlan } from "../_shared/stripe.ts";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

function timestampToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const signature = req.headers.get("Stripe-Signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!signature || !webhookSecret) return new Response("Webhook is not configured", { status: 503 });
    const rawBody = await req.text();
    const event = await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      const item = subscription.items.data[0];
      const plan = item ? resolveStripePlan(item.price.id) : null;
      const userId = subscription.metadata.userId;
      const organizationId = subscription.metadata.orgId;
      if (!plan || !userId || !organizationId) {
        console.error("Stripe subscription is missing recognized plan metadata", event.id);
        return new Response("Unrecognized subscription metadata", { status: 400 });
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const customerId = typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
      const firstItem = subscription.items.data[0] as Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      };
      const periodStart = (subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start
        ?? firstItem?.current_period_start;
      const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
        ?? firstItem?.current_period_end;

      const { error } = await admin.from("subscriptions").upsert({
        user_id: userId,
        organization_id: organizationId,
        billing_provider: "stripe",
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        product_id: plan.productId,
        price_id: plan.priceId,
        status: subscription.status,
        current_period_start: timestampToIso(periodStart),
        current_period_end: timestampToIso(periodEnd),
        cancel_at_period_end: subscription.cancel_at_period_end,
        environment: getBillingEnvironment(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" });
      if (error) throw error;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripe-webhook error", error);
    return new Response(`Webhook error: ${(error as Error).message}`, { status: 400 });
  }
});
