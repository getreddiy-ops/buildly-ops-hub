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

// Legacy migration helpers remain available while existing HighLevel data is
// being exported, but FastTract no longer depends on HighLevel for normal app
// saves. These functions can be removed after migration/porting is complete.
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

// Compatibility no-op. Older screens still call this after native FastTract
// writes; keeping the function prevents a risky broad refactor while ensuring
// those saves never leave FastTract or depend on GHL.
export function syncToGhl(_organizationId: string, _entity: GhlEntity, _id: string): void {
  // Intentionally disabled: FastTract is now the system of record.
}
