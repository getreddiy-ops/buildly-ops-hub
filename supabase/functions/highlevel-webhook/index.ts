import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { getConnectionByLocationOrCompany } from '../_shared/ghl.ts';

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

type Json = Record<string, unknown>;

function pick(...sources: (Json | undefined | null)[]): Json {
  const out: Json = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (out[key] === undefined && value !== undefined) out[key] = value;
    }
  }
  return out;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Contact fields can arrive nested under `contact` (workflow webhooks) or at
// the payload root (native app webhooks) depending on how the event was set up.
function extractContact(payload: Json) {
  const c = pick(payload.contact as Json, payload);
  const first = str(c.firstName);
  const last = str(c.lastName);
  const name = str(c.name) ?? str(c.fullName) ?? [first, last].filter(Boolean).join(' ').trim();
  const addressParts = [str(c.address1), str(c.city), str(c.state), str(c.postalCode)].filter(Boolean);
  return {
    ghlContactId: str(c.id) ?? str(c.contactId),
    name: name || null,
    email: str(c.email),
    phone: str(c.phone),
    address: addressParts.length > 0 ? addressParts.join(', ') : str(c.address),
  };
}

function extractOpportunity(payload: Json) {
  const o = pick(payload.opportunity as Json, payload);
  return {
    ghlOpportunityId: str(o.id) ?? str(o.opportunityId),
    contactId: str(o.contactId),
    // GHL opportunities carry both a coarse status (open/won/lost/abandoned)
    // and a pipeline-specific stage name/id — we keep the stage as free text
    // rather than force-fitting it into FastTract's fixed lead_status enum.
    status: str(o.status)?.toLowerCase() ?? null,
    stage: str(o.pipelineStageName) ?? str(o.stageName) ?? str(o.pipelineStageId) ?? null,
  };
}

function extractAppointment(payload: Json) {
  const a = pick(payload.appointment as Json, payload);
  return {
    ghlAppointmentId: str(a.id) ?? str(a.appointmentId),
    title: str(a.title) ?? 'HighLevel appointment',
    startTime: str(a.startTime),
    endTime: str(a.endTime),
    contactId: str(a.contactId),
  };
}

async function processContactEvent(
  admin: SupabaseClient,
  organizationId: string,
  payload: Json,
) {
  const contact = extractContact(payload);
  if (!contact.ghlContactId || !contact.name) return;

  // A contact that already converted to a customer shouldn't be re-created as a lead.
  const { data: existingCustomer } = await admin
    .from('customers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('ghl_contact_id', contact.ghlContactId)
    .maybeSingle();
  if (existingCustomer) {
    await admin
      .from('customers')
      .update({ name: contact.name, email: contact.email, phone: contact.phone, address: contact.address })
      .eq('id', existingCustomer.id);
    return;
  }

  await admin.from('leads').upsert(
    {
      organization_id: organizationId,
      ghl_contact_id: contact.ghlContactId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      source: 'HighLevel',
    },
    { onConflict: 'organization_id,ghl_contact_id' },
  );
}

async function processAppointmentEvent(
  admin: SupabaseClient,
  organizationId: string,
  payload: Json,
) {
  const appt = extractAppointment(payload);
  if (!appt.ghlAppointmentId || !appt.startTime || !appt.endTime) return;

  let customerId: string | null = null;
  if (appt.contactId) {
    const { data: customer } = await admin
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('ghl_contact_id', appt.contactId)
      .maybeSingle();
    customerId = customer?.id ?? null;
  }

  await admin.from('jobs').upsert(
    {
      organization_id: organizationId,
      ghl_appointment_id: appt.ghlAppointmentId,
      title: appt.title,
      customer_id: customerId,
      scheduled_start: appt.startTime,
      scheduled_end: appt.endTime,
    },
    { onConflict: 'organization_id,ghl_appointment_id' },
  );
}

async function processOpportunityEvent(
  admin: SupabaseClient,
  organizationId: string,
  payload: Json,
) {
  const opp = extractOpportunity(payload);
  if (!opp.contactId) return;

  const { data: lead } = await admin
    .from('leads')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('ghl_contact_id', opp.contactId)
    .maybeSingle();
  if (!lead) return;

  const patch: Record<string, unknown> = {};
  if (opp.stage) patch.ghl_pipeline_stage = opp.stage;
  // Only "won"/"lost" map onto FastTract's lead_status enum; every other
  // GHL pipeline movement is reflected via ghl_pipeline_stage only, so we
  // never overwrite a status FastTract itself is actively managing (e.g.
  // "qualified") with a guess at what an arbitrary GHL stage name means.
  if (opp.status === 'won' || opp.status === 'lost') patch.status = opp.status;

  if (Object.keys(patch).length === 0) return;
  await admin.from('leads').update(patch).eq('id', lead.id);
}

async function processEvent(
  admin: SupabaseClient,
  eventType: string,
  locationId: string | null,
  companyId: string | null,
  payload: Json,
) {
  const connection = await getConnectionByLocationOrCompany(admin, locationId, companyId);
  if (!connection?.organization_id) return;

  if (eventType.startsWith('Contact')) {
    await processContactEvent(admin, connection.organization_id, payload);
  } else if (eventType.startsWith('Appointment')) {
    await processAppointmentEvent(admin, connection.organization_id, payload);
  } else if (eventType.startsWith('Opportunity')) {
    await processOpportunityEvent(admin, connection.organization_id, payload);
  }
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

  try {
    await processEvent(supabase, eventType, locationId, companyId, payload);
  } catch (processingError) {
    // The raw event is already durably stored; a processing failure here
    // (bad payload shape, unmapped org, etc.) should not fail the webhook.
    console.error('Could not process HighLevel event into FastTract records:', processingError);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
