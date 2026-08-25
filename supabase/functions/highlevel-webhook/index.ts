import { createClient } from 'npm:@supabase/supabase-js@2';

// HighLevel's current webhook signing key (Ed25519).
// Source: https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/
const GHL_PUBLIC_KEY_SPKI_BASE64 =
  'MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=';

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyGhlSignature(rawBody: string, signature: string): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      base64ToBytes(GHL_PUBLIC_KEY_SPKI_BASE64),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      base64ToBytes(signature),
      new TextEncoder().encode(rawBody),
    );
  } catch (error) {
    console.error('Could not verify HighLevel webhook signature:', error);
    return false;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-ghl-signature');

  if (!signature || !(await verifyGhlSignature(rawBody, signature))) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const webhookId =
    typeof payload.webhookId === 'string' && payload.webhookId.length > 0
      ? payload.webhookId
      : `sha256:${await sha256Hex(rawBody)}`;

  const eventType =
    typeof payload.type === 'string' && payload.type.length > 0 ? payload.type : 'unknown';
  const locationId = typeof payload.locationId === 'string' ? payload.locationId : null;
  const companyId = typeof payload.companyId === 'string' ? payload.companyId : null;

  const { error } = await supabase.from('highlevel_events').upsert(
    {
      webhook_id: webhookId,
      event_type: eventType,
      location_id: locationId,
      company_id: companyId,
      payload,
      received_at: new Date().toISOString(),
    },
    { onConflict: 'webhook_id', ignoreDuplicates: true },
  );

  if (error) {
    console.error('Could not persist HighLevel webhook:', error);
    return new Response('Webhook persistence failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
