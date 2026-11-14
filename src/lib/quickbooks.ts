import { supabase } from "@/integrations/supabase/client";

const LAST_AUTO_SYNC_KEY = "fasttract:qb-auto-sync";

/** Sends the named invoices (or everything changed since the last sync) to QuickBooks. Never throws. */
export async function syncToQuickBooks(organizationId: string, invoiceIds?: string[]) {
  try {
    const { data, error } = await supabase.functions.invoke("quickbooks", { body: { organizationId, invoiceIds } });
    if (error) return { ok: false as const, error };
    return { ok: true as const, data: data as { synced: number; failed: number; more: boolean } };
  } catch (error) {
    return { ok: false as const, error };
  }
}

/** Quietly catches up QuickBooks when the invoice list opens, at most every 10 minutes per browser. */
export function autoSyncQuickBooks(organizationId: string) {
  try {
    const last = Number(sessionStorage.getItem(`${LAST_AUTO_SYNC_KEY}:${organizationId}`) ?? 0);
    if (Date.now() - last < 10 * 60_000) return;
    sessionStorage.setItem(`${LAST_AUTO_SYNC_KEY}:${organizationId}`, String(Date.now()));
  } catch { /* storage unavailable: still sync */ }
  void syncToQuickBooks(organizationId);
}
