// Shared helpers for talking to GoHighLevel (LeadConnector) from Edge Functions:
// signed OAuth state, access-token refresh, and the contact/appointment API calls
// used by both the inbound webhook processor and the outbound ghl-sync function.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const GHL_API_BASE = "https://services.leadconnectorhq.com";
export const GHL_API_VERSION = "2021-07-28";
export const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
export const GHL_AUTHORIZE_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation";

export const DEFAULT_GHL_SCOPES =
  "contacts.readonly contacts.write calendars.readonly calendars/events.readonly calendars/events.write opportunities.readonly opportunities.write invoices.readonly invoices.write";

export function requiredSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(
    requiredSecret("SUPABASE_URL"),
    requiredSecret("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type OAuthStatePayload = { organizationId: string; exp: number };

// Signed, expiring OAuth `state` so the callback can trust which org initiated
// the connect flow without round-tripping through a server-side session.
export async function signOAuthState(secret: string, organizationId: string): Promise<string> {
  const payload: OAuthStatePayload = { organizationId, exp: Date.now() + 10 * 60 * 1000 };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(signature)}`;
}

export async function verifyOAuthState(secret: string, state: string): Promise<string | null> {
  const [payloadPart, signaturePart] = state.split(".");
  if (!payloadPart || !signaturePart) return null;
  try {
    const key = await hmacKey(secret);
    const payloadBytes = base64UrlToBytes(payloadPart);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signaturePart),
      payloadBytes,
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as OAuthStatePayload;
    if (!payload.organizationId || payload.exp < Date.now()) return null;
    return payload.organizationId;
  } catch {
    return null;
  }
}

export type GhlConnection = {
  id: string;
  organization_id: string | null;
  connection_key: string;
  company_id: string | null;
  location_id: string | null;
  user_type: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  default_calendar_id: string | null;
  pipeline_stage_map: Record<string, string>;
};

export async function getConnectionForOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GhlConnection | null> {
  const { data } = await admin
    .from("ghl_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (data as GhlConnection | null) ?? null;
}

export async function getConnectionByLocationOrCompany(
  admin: SupabaseClient,
  locationId: string | null,
  companyId: string | null,
): Promise<GhlConnection | null> {
  if (locationId) {
    const { data } = await admin
      .from("ghl_connections")
      .select("*")
      .eq("location_id", locationId)
      .maybeSingle();
    if (data) return data as GhlConnection;
  }
  if (companyId) {
    const { data } = await admin
      .from("ghl_connections")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) return data as GhlConnection;
  }
  return null;
}

// Refreshes the access token when it is expired or close to it, persisting
// the new tokens, and returns a connection guaranteed to have a live token.
export async function ensureFreshConnection(
  admin: SupabaseClient,
  connection: GhlConnection,
): Promise<GhlConnection> {
  const expiresAt = new Date(connection.expires_at).getTime();
  if (expiresAt - Date.now() > 5 * 60 * 1000) return connection;

  const tokenResponse = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: requiredSecret("GHL_CLIENT_ID"),
      client_secret: requiredSecret("GHL_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
      user_type: connection.user_type,
    }),
  });

  if (!tokenResponse.ok) {
    await tokenResponse.body?.cancel();
    throw new Error(`HighLevel token refresh failed (${tokenResponse.status})`);
  }

  const token = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    expires_in?: number;
  };

  const updated: GhlConnection = {
    ...connection,
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? connection.refresh_token,
    token_type: token.token_type ?? connection.token_type,
    expires_at: new Date(Date.now() + Math.max(0, token.expires_in ?? 86400) * 1000).toISOString(),
  };

  const { error } = await admin
    .from("ghl_connections")
    .update({
      access_token: updated.access_token,
      refresh_token: updated.refresh_token,
      token_type: updated.token_type,
      expires_at: updated.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
  if (error) throw new Error(`Could not persist refreshed HighLevel token: ${error.message}`);

  return updated;
}

export async function ghlFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Version: GHL_API_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export type ContactFields = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

// Creates or updates a GHL contact keyed by email/phone (GHL's own dedupe
// rules) and returns its contact id.
export async function upsertGhlContact(
  connection: GhlConnection,
  fields: ContactFields,
): Promise<string> {
  if (!connection.location_id) throw new Error("HighLevel connection has no locationId");
  const response = await ghlFetch(connection.access_token, "/contacts/upsert", {
    method: "POST",
    body: JSON.stringify({
      locationId: connection.location_id,
      name: fields.name || undefined,
      email: fields.email || undefined,
      phone: fields.phone || undefined,
      address1: fields.address || undefined,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HighLevel contact upsert failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { contact?: { id?: string }; id?: string };
  const contactId = data.contact?.id ?? data.id;
  if (!contactId) throw new Error("HighLevel contact upsert response is missing an id");
  return contactId;
}

export type AppointmentFields = {
  title: string;
  startTime: string;
  endTime: string;
  contactId?: string | null;
};

export async function createGhlAppointment(
  connection: GhlConnection,
  fields: AppointmentFields,
): Promise<string> {
  if (!connection.default_calendar_id) throw new Error("No default GHL calendar configured");
  if (!connection.location_id) throw new Error("HighLevel connection has no locationId");
  const response = await ghlFetch(connection.access_token, "/calendars/events/appointments", {
    method: "POST",
    body: JSON.stringify({
      calendarId: connection.default_calendar_id,
      locationId: connection.location_id,
      title: fields.title,
      startTime: fields.startTime,
      endTime: fields.endTime,
      contactId: fields.contactId || undefined,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HighLevel appointment create failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("HighLevel appointment create response is missing an id");
  return data.id;
}

export async function updateGhlAppointment(
  connection: GhlConnection,
  appointmentId: string,
  fields: AppointmentFields,
): Promise<void> {
  const response = await ghlFetch(connection.access_token, `/calendars/events/appointments/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify({
      title: fields.title,
      startTime: fields.startTime,
      endTime: fields.endTime,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HighLevel appointment update failed (${response.status}): ${body}`);
  }
}

// Invoices (backed by GHL's connected Stripe account).
//
// Get Invoice, the InvoicePaid webhook, and now Update Invoice are
// implemented. The nested-object schemas for Update Invoice's
// `contactDetails`, `businessDetails`, and `invoiceItems` come from
// HighLevel's own official SDK, @gohighlevel/api-client (npm, published by
// HighLevel's marketplace account, repo github.com/GoHighLevel/highlevel-api-sdk),
// version 3.1.0, dist/lib/code/invoices/models/invoices.d.ts -- specifically
// the ContactDetailsDto, BusinessDetailsDto, and InvoiceItemDto interfaces
// (the same shapes UpdateInvoiceDto's fields are typed with) -- not guessed.
//
// Create Invoice (POST /invoices/) is still NOT implemented: its `discount`
// field is required (unlike Update Invoice's, which is optional), and
// `DiscountDto.type` is typed as a bare `string` in that same official SDK
// with no enum preserved anywhere in it -- and marketplace.gohighlevel.com,
// where the enum might be documented in prose, is unreachable from this
// sandbox (network egress to every gohighlevel.com subdomain is blocked).
// Guessing "percentage" (the only value that turned up, and only in
// secondhand blog/search summaries, never a primary source) risks silently
// misapplying a discount instead of a loud API error.
//
// Send Invoice (POST /invoices/{id}/send) is also NOT implemented: its
// required `action` field is typed as a bare `string` in the same official
// SDK too, with no enum anywhere -- same blocker as above, same
// unreachable page. It also needs a GHL `userId` (the sending "employee or
// agency ID"), which FastTract has no established mapping for either.
//
// Line-item and invoice-total amounts are assumed to be in cents (the one
// place a unit is documented at all is the InvoicePaid webhook's `amount`/
// `amountPaid` fields, "Total invoice amount (in cents)" / "Amount paid (in
// cents)") and applied consistently to every monetary field on the same
// invoice object. This is an inference, not a separately confirmed fact for
// line items specifically -- verify with a $1 test invoice against a real
// account before relying on it.
//
// The fields below are the ones actually named in the GHL Invoice API
// reference the org owner provided (Get Invoice's own field list, plus the
// InvoicePaid webhook's payload table, which documents the same invoice
// object shape). No field name here is guessed. Notably absent: any kind
// of payment/invoice URL -- the docs provided don't name that field, so
// FastTract cannot populate one without guessing.
export type GhlInvoice = {
  id: string;
  status: string;
  amount: number;
  amountPaid: number;
  currency: string;
  contactId?: string;
  name?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  paidAt?: string;
};

export async function getGhlInvoice(connection: GhlConnection, invoiceId: string): Promise<GhlInvoice> {
  if (!connection.location_id) throw new Error("HighLevel connection has no locationId");
  const url = `/invoices/${invoiceId}?altId=${encodeURIComponent(connection.location_id)}&altType=location`;
  const response = await ghlFetch(connection.access_token, url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HighLevel get invoice failed (${response.status}): ${body}`);
  }
  return (await response.json()) as GhlInvoice;
}

// Update Invoice's nested shapes, per @gohighlevel/api-client@3.1.0's
// ContactDetailsDto / BusinessDetailsDto / InvoiceItemDto (see the comment
// above GhlInvoice). Address sub-objects are intentionally omitted:
// FastTract stores a single free-text `address` column for both
// organizations and customers, and decomposing that into
// addressLine1/city/state/postalCode would mean guessing a parsing
// scheme, not reading a schema.
export type GhlContactDetails = {
  id: string;
  name: string;
  phoneNo: string;
  email: string;
  companyName?: string;
};

export type GhlBusinessDetails = {
  name?: string;
  phoneNo?: string;
  website?: string;
  logoUrl?: string;
};

export type GhlInvoiceItem = {
  name: string;
  description?: string;
  currency: string;
  amount: number;
  qty: number;
};

export type FastTractLineItem = { description: string; quantity: number; unit_price: number };

// Maps FastTract's invoice_line_items rows onto GhlInvoiceItem. Amounts are
// converted to cents (see the unit-convention note above GhlInvoice).
// Throws rather than silently sending a malformed/empty invoice.
export function buildGhlInvoiceItems(lineItems: FastTractLineItem[]): GhlInvoiceItem[] {
  if (lineItems.length === 0) {
    throw new Error("At least one line item is required");
  }
  return lineItems.map((li) => ({
    name: li.description,
    currency: "USD",
    amount: Math.round(li.unit_price * 100),
    qty: li.quantity,
  }));
}

export type UpdateGhlInvoiceInput = {
  name: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  items: GhlInvoiceItem[];
  contactDetails?: GhlContactDetails;
  businessDetails?: GhlBusinessDetails;
  termsNotes?: string;
};

export async function updateGhlInvoice(
  connection: GhlConnection,
  invoiceId: string,
  input: UpdateGhlInvoiceInput,
): Promise<GhlInvoice> {
  if (!connection.location_id) throw new Error("HighLevel connection has no locationId");
  const body: Record<string, unknown> = {
    altId: connection.location_id,
    altType: "location",
    name: input.name,
    currency: input.currency,
    invoiceItems: input.items,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
  };
  if (input.contactDetails) body.contactDetails = input.contactDetails;
  if (input.businessDetails) body.businessDetails = input.businessDetails;
  if (input.termsNotes) body.termsNotes = input.termsNotes;

  const response = await ghlFetch(connection.access_token, `/invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HighLevel update invoice failed (${response.status}): ${errBody}`);
  }
  return (await response.json()) as GhlInvoice;
}

export type GhlInvoiceSyncFields = {
  ghl_invoice_status: string | null;
  ghl_last_synced_at: string;
  ghl_paid_at?: string;
};

// The columns common to both `invoices` and `estimates` (see
// 20260916060000_ghl_invoice_sync_state.sql), shared by the manual
// Get-Invoice sync path and the InvoicePaid webhook so both update this
// state the same way. Idempotent: calling this repeatedly with the same
// GHL invoice state produces the same fields.
//
// Deliberately conservative: `ghl_invoice_status` stores GHL's raw status
// string as-is (never interpreted), and only the one documented value,
// "paid" (per the InvoicePaid webhook's field table), drives `ghl_paid_at`.
// GHL's non-paid status vocabulary (e.g. what a freshly-sent invoice's
// status string looks like) isn't documented anywhere in the reference
// provided, so `ghl_sent_at` is never set here -- it can only be set by
// FastTract's own Send Invoice call, which isn't implemented (see the
// comment above `GhlInvoice`). `ghl_invoice_url` is also never set here
// for the same reason: no field name for it is documented.
//
// Table-specific fields (invoices.status/amount_paid vs.
// estimates.deposit_collected/deposit_collected_at) are the caller's
// responsibility -- the two tables don't share a status vocabulary.
export function buildGhlInvoiceSyncFields(
  invoice: Pick<GhlInvoice, "status" | "paidAt">,
): GhlInvoiceSyncFields {
  const fields: GhlInvoiceSyncFields = {
    ghl_invoice_status: invoice.status ?? null,
    ghl_last_synced_at: new Date().toISOString(),
  };
  if (invoice.status === "paid") {
    fields.ghl_paid_at = invoice.paidAt ?? new Date().toISOString();
  }
  return fields;
}
