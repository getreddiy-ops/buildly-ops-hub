// Stripe webhook receiver. Verifies Stripe-Signature, processes events
// idempotently, and syncs subscription state into public.subscriptions.
import { createClient } from "npm:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@17";
import {
  getStripe,
  stripeEnvironment,
  tierFromStripePrice,
  TIER_LOGICAL_PRICE,
  TIER_LOGICAL_PRODUCT,
} from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

const ts = (secs: number | null | undefined) =>
  secs ? new Date(secs * 1000).toISOString() : null;

async function syncSubscription(sub: Stripe.Subscription, paymentStatus?: string) {
  const env = stripeEnvironment();
  const item = sub.items.data[0];
  const stripePriceId = item?.price?.id ?? null;
  const tier = tierFromStripePrice(stripePriceId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  const meta = (sub.metadata ?? {}) as Record<string, string>;
  let userId = meta.userId || null;
  let organizationId = meta.organizationId || null;

  if (!organizationId && customerId) {
    const { data: bc } = await admin()
      .from("billing_customers")
      .select("organization_id, user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    organizationId = (bc?.organization_id as string) ?? null;
    userId = userId ?? ((bc?.user_id as string) ?? null);
  }
  if (!userId && organizationId) {
    const { data: owner } = await admin()
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner")
      .maybeSingle();
    userId = (owner?.user_id as string) ?? null;
  }
  if (!userId) {
    console.error("stripe-webhook: cannot resolve user for subscription", sub.id);
    return;
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    organization_id: organizationId,
    provider: "stripe",
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId ?? null,
    stripe_price_id: stripePriceId,
    price_id: tier ? TIER_LOGICAL_PRICE[tier] : (stripePriceId ?? "unknown"),
    product_id: tier ? TIER_LOGICAL_PRODUCT[tier] : null,
    status: sub.status,
    current_period_start: ts((sub as any).current_period_start ?? item?.current_period_start),
    current_period_end: ts((sub as any).current_period_end ?? item?.current_period_end),
    trial_end: ts(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    environment: env,
    updated_at: new Date().toISOString(),
  };
  if (paymentStatus) row.payment_status = paymentStatus;

  const { error } = await admin()
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) console.error("stripe-webhook upsert failed:", error);

  // Mark the trial as consumed so a repeat checkout cannot grant another one.
  if (organizationId && sub.trial_end) {
    await admin()
      .from("billing_customers")
      .update({ trial_used: true })
      .eq("organization_id", organizationId);
  }
}

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
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin()
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
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
