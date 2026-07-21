import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }
  return _supabase;
}

type ExistingSubscription = {
  user_id: string;
  organization_id: string | null;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
};

async function getExistingSubscription(id: string, env: PaddleEnv) {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('user_id,organization_id,paddle_customer_id,product_id,price_id')
    .eq('paddle_subscription_id', id)
    .eq('environment', env)
    .maybeSingle();
  if (error) throw new Error(`Could not read subscription ${id}: ${error.message}`);
  return data as ExistingSubscription | null;
}

/**
 * Every subscription lifecycle event carries the full subscription entity, but
 * providers may deliver events out of order. Upserting all lifecycle events
 * makes the handler idempotent and prevents an update arriving before create
 * from being acknowledged without actually granting access.
 */
async function upsertSubscription(data: any, env: PaddleEnv, statusOverride?: string) {
  const id = data?.id as string | undefined;
  if (!id) throw new Error('Subscription event is missing an id');

  const existing = await getExistingSubscription(id, env);
  const item = data?.items?.[0];
  const customData = data?.customData;
  const userId = customData?.userId ?? existing?.user_id;
  const organizationId =
    customData?.orgId ?? customData?.organizationId ?? existing?.organization_id ?? null;
  const customerId = data?.customerId ?? existing?.paddle_customer_id;
  const priceId = item?.price?.importMeta?.externalId ?? existing?.price_id;
  const productId = item?.product?.importMeta?.externalId ?? existing?.product_id;

  if (!userId || !organizationId || !customerId || !priceId || !productId) {
    throw new Error(
      `Subscription ${id} is missing checkout ownership or catalog metadata`,
    );
  }

  const { error } = await getSupabase().from('subscriptions').upsert({
    user_id: userId,
    organization_id: organizationId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status: statusOverride ?? data.status,
    current_period_start: data?.currentBillingPeriod?.startsAt ?? null,
    current_period_end: data?.currentBillingPeriod?.endsAt ?? null,
    cancel_at_period_end:
      statusOverride === 'canceled' ? false : data?.scheduledChange?.action === 'cancel',
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'paddle_subscription_id' });

  // Never acknowledge a Paddle webhook when the entitlement write failed.
  // A non-2xx response lets Paddle retry instead of leaving a paying customer
  // permanently locked out.
  if (error) throw new Error(`Could not persist subscription ${id}: ${error.message}`);
}

async function verifyForEnvironment(req: Request, requestedEnv: string | null) {
  if (requestedEnv && requestedEnv !== 'live' && requestedEnv !== 'sandbox') {
    throw new Error('Invalid Paddle environment');
  }

  if (requestedEnv) {
    const env = requestedEnv as PaddleEnv;
    return { event: await verifyWebhook(req.clone(), env), env };
  }

  // Older notification destinations may not include ?env=. Try live first so
  // a live checkout is never accidentally verified with sandbox credentials.
  try {
    return { event: await verifyWebhook(req.clone(), 'live'), env: 'live' as PaddleEnv };
  } catch (liveError) {
    try {
      return { event: await verifyWebhook(req.clone(), 'sandbox'), env: 'sandbox' as PaddleEnv };
    } catch {
      throw liveError;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  try {
    const { event, env } = await verifyForEnvironment(req, url.searchParams.get('env'));
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
        await upsertSubscription(event.data, env); break;
      case EventName.SubscriptionUpdated:
        await upsertSubscription(event.data, env); break;
      case EventName.SubscriptionCanceled:
        await upsertSubscription(event.data, env, 'canceled'); break;
      default:
        console.log('Unhandled event:', event.eventType);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});
