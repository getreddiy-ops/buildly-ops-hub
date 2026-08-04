// Stripe webhook receiver. Verifies Stripe-Signature, processes events
// idempotently, and syncs subscription state into public.subscriptions.
import type Stripe from "npm:stripe@17";
import { getStripe } from "../_shared/stripe.ts";
import { admin, syncSubscription } from "../_shared/stripe-sync.ts";

async function syncFromInvoice(invoice: Stripe.Invoice, paymentStatus: string) {
  const subId =
    typeof (invoice as any).subscription === "string"
      ? (invoice as any).subscription
      : (invoice as any).subscription?.id ??
        (invoice as any).parent?.subscription_details?.subscription ??
        null;
  if (!subId) return;
  const sub = await getStripe().subscriptions.retrieve(subId as string);
  await syncSubscription(sub as Stripe.Subscription, paymentStatus);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    console.error("Signature verification failed:", (e as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: record the event id first; a duplicate insert means we already handled it.
  const { error: dupErr } = await admin()
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type });
  if (dupErr) {
    if ((dupErr as any).code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("event log insert failed:", dupErr);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(subId);
          // Ensure metadata is present for later events.
          const meta = (session.metadata ?? {}) as Record<string, string>;
          if (meta.organizationId && !sub.metadata?.organizationId) {
            await getStripe().subscriptions.update(subId, { metadata: meta });
            (sub as Stripe.Subscription).metadata = meta as any;
          }
          await syncSubscription(sub as Stripe.Subscription, session.payment_status ?? undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
      case "customer.subscription.trial_will_end":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // Access ends now: Stripe has already ended the subscription.
        await admin()
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
            current_period_end: new Date().toISOString(),
            scheduled_price_id: null,
            scheduled_change_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      case "invoice.paid":
        await syncFromInvoice(event.data.object as Stripe.Invoice, "paid");
        break;
      case "invoice.payment_failed":
        await syncFromInvoice(event.data.object as Stripe.Invoice, "failed");
        break;
      case "invoice.payment_action_required":
        await syncFromInvoice(event.data.object as Stripe.Invoice, "action_required");
        break;
      default:
        console.log("Unhandled Stripe event:", event.type);
    }
  } catch (e) {
    console.error("stripe-webhook handler error:", e);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
