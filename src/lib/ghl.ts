import { supabase } from "@/integrations/supabase/client";

export type GhlEntity = "lead" | "customer" | "job";

export type GhlStatus = {
  connected: boolean;
  locationId: string | null;
  companyId: string | null;
  installedAt: string | null;
  defaultCalendarId: string | null;
  pipelineStageMap: Record<string, string>;
  defaultSenderUserId: string | null;
};

export async function getGhlStatus(organizationId: string): Promise<GhlStatus> {
  const { data, error } = await supabase.functions.invoke("ghl-connection", {
    body: { organizationId, action: "status" },
  });
  if (error) throw error;
  return data as GhlStatus;
}

export async function startGhlConnect(organizationId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("ghl-oauth-start", {
    body: { organizationId },
  });
  if (error) throw error;
  const url = (data as { url?: string })?.url;
  if (!url) throw new Error("HighLevel did not return an authorization URL");
  window.location.href = url;
}

export async function disconnectGhl(organizationId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("ghl-connection", {
    body: { organizationId, action: "disconnect" },
  });
  if (error) throw error;
}

export async function setGhlCalendar(organizationId: string, calendarId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("ghl-connection", {
    body: { organizationId, action: "set_calendar", calendarId },
  });
  if (error) throw error;
}

export async function setGhlPipelineStageMap(organizationId: string, pipelineStageMap: Record<string, string>): Promise<void> {
  const { data, error } = await supabase.functions.invoke("ghl-connection", {
    body: { organizationId, action: "set_pipeline_map", pipelineStageMap },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export type GhlLocationUser = { id: string; name?: string; email?: string };

// The HighLevel users assigned to this org's connected location, so the
// org can pick which one Send Invoice records as the sender (there's no
// safe way to infer this -- see the comment above GhlInvoice in
// supabase/functions/_shared/ghl.ts).
export async function listGhlUsers(organizationId: string): Promise<GhlLocationUser[]> {
  const { data, error } = await supabase.functions.invoke("ghl-connection", {
    body: { organizationId, action: "list_users" },
  });
  if (error) throw error;
  const result = data as { error?: string; users?: GhlLocationUser[] };
  if (result?.error) throw new Error(result.error);
  return result?.users ?? [];
}

export async function setGhlSenderUserId(organizationId: string, senderUserId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("ghl-connection", {
    body: { organizationId, action: "set_sender_user_id", senderUserId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Fire-and-forget: push a just-created/updated record to GHL. Failures are
// logged, not surfaced, so a HighLevel hiccup never blocks the FastTract save.
export function syncToGhl(organizationId: string, entity: GhlEntity, id: string): void {
  supabase.functions
    .invoke("ghl-sync", { body: { organizationId, entity, id } })
    .then(({ error }) => {
      if (error) console.error(`ghl-sync (${entity}) failed:`, error);
    })
    .catch((error) => console.error(`ghl-sync (${entity}) failed:`, error));
}

export type GhlInvoiceKind = "invoice" | "estimate";

// Links an invoice/estimate to a GHL invoice the contractor already created
// in GHL's own UI (FastTract can't create GHL invoices itself yet -- see
// the comment above GhlInvoice in supabase/functions/_shared/ghl.ts), and
// pulls its current status/payment state.
export async function linkGhlInvoice(
  organizationId: string,
  kind: GhlInvoiceKind,
  id: string,
  ghlInvoiceId: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("ghl-invoice-sync", {
    body: { organizationId, action: "link", kind, id, ghlInvoiceId },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
}

// Re-fetches the linked GHL invoice's current status/payment state.
export async function syncGhlInvoice(organizationId: string, kind: GhlInvoiceKind, id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("ghl-invoice-sync", {
    body: { organizationId, action: "sync", kind, id },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
}

export type GhlInvoicePushPreview = {
  pending: true;
  preview: Record<string, unknown>;
  message: string;
};

// Pushes FastTract's current header/line items into an already-linked GHL
// invoice (Update Invoice). Two-step, mirroring the confirm-before-write
// pattern used everywhere else a write has real-world consequences: the
// first call (confirm omitted/false) only returns a preview of what would
// be sent, and nothing is applied until a second call passes confirm: true.
export async function pushGhlInvoiceUpdate(
  organizationId: string,
  id: string,
  confirm: boolean,
): Promise<GhlInvoicePushPreview | { updated: true }> {
  const { data, error } = await supabase.functions.invoke("ghl-invoice-sync", {
    body: { organizationId, action: "update", kind: "invoice", id, confirm },
  });
  if (error) throw error;
  const result = data as { error?: string; pending?: true; preview?: Record<string, unknown>; message?: string; updated?: true };
  if (result?.error) throw new Error(result.error);
  if (result?.pending) return { pending: true, preview: result.preview!, message: result.message! };
  return { updated: true };
}

// Creates this invoice in HighLevel for the first time. FastTract can't
// create a HighLevel invoice for a customer that isn't fully synced there
// yet (name/phone/email + a linked HighLevel contact, plus an email
// address -- both required by HighLevel's Create Invoice); the edge
// function reports exactly what's missing rather than guessing.
export async function pushGhlInvoiceCreate(
  organizationId: string,
  id: string,
  confirm: boolean,
): Promise<GhlInvoicePushPreview | { created: true }> {
  const { data, error } = await supabase.functions.invoke("ghl-invoice-sync", {
    body: { organizationId, action: "create", kind: "invoice", id, confirm },
  });
  if (error) throw error;
  const result = data as { error?: string; pending?: true; preview?: Record<string, unknown>; message?: string; created?: true };
  if (result?.error) throw new Error(result.error);
  if (result?.pending) return { pending: true, preview: result.preview!, message: result.message! };
  return { created: true };
}

export type GhlSendChannel = "email" | "sms" | "sms_and_email";

// Never returns a channel the customer lacks contact info for -- both the
// UI (which channel picker to show) and the "no duplicate/silent sends"
// requirement depend on this. The edge function re-validates this
// server-side too; this is the client-side half of the same rule.
export function availableGhlSendChannels(customer: { email?: string | null; phone?: string | null } | null | undefined): GhlSendChannel[] {
  const hasEmail = !!customer?.email;
  const hasPhone = !!customer?.phone;
  const channels: GhlSendChannel[] = [];
  if (hasEmail) channels.push("email");
  if (hasPhone) channels.push("sms");
  if (hasEmail && hasPhone) channels.push("sms_and_email");
  return channels;
}

// Sends an already-created/linked HighLevel invoice to the customer.
// FastTract never silently picks a channel the customer lacks contact info
// for -- the edge function validates this server-side too, not just here.
export async function sendGhlInvoicePush(
  organizationId: string,
  id: string,
  channel: GhlSendChannel,
  confirm: boolean,
): Promise<GhlInvoicePushPreview | { sent: true }> {
  const { data, error } = await supabase.functions.invoke("ghl-invoice-sync", {
    body: { organizationId, action: "send", kind: "invoice", id, channel, confirm },
  });
  if (error) throw error;
  const result = data as { error?: string; pending?: true; preview?: Record<string, unknown>; message?: string; sent?: true };
  if (result?.error) throw new Error(result.error);
  if (result?.pending) return { pending: true, preview: result.preview!, message: result.message! };
  return { sent: true };
}
