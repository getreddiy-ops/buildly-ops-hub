import { supabase } from "@/integrations/supabase/client";

export type GhlEntity = "lead" | "customer" | "job";

export type GhlStatus = {
  connected: boolean;
  locationId: string | null;
  companyId: string | null;
  installedAt: string | null;
  defaultCalendarId: string | null;
  pipelineStageMap: Record<string, string>;
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
