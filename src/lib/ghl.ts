import { supabase } from "@/integrations/supabase/client";

export type GhlEntity = "lead" | "customer" | "job";

export type GhlStatus = {
  connected: boolean;
  locationId: string | null;
  companyId: string | null;
  installedAt: string | null;
  defaultCalendarId: string | null;
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
