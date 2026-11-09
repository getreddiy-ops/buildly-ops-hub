import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { readFunctionError } from "@/lib/function-error";

type Status = { connected: boolean; healthy: boolean; companyName?: string | null; error?: string; recent?: { entity_type: string; status: string; error: string | null; created_at: string }[] };

const RETURN_MESSAGES: Record<string, [string, "success" | "error"]> = {
  connected: ["QuickBooks connected. Sent and paid invoices will now copy over.", "success"],
  declined: ["QuickBooks connection was cancelled.", "error"],
  expired: ["That connection link expired. Try Connect again.", "error"],
  forbidden: ["Only the business owner or an admin can connect QuickBooks.", "error"],
  error: ["QuickBooks couldn't be connected. Try again.", "error"],
};

/** Settings → QuickBooks: connect the business's QuickBooks Online company and keep invoices in sync. */
export function QuickBooksCard() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id;
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null);
  const [params, setParams] = useSearchParams();

  const call = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke("quickbooks", { body: { organizationId: orgId, action } });
    if (error) throw error;
    return data;
  }, [orgId]);

  const refresh = useCallback(async () => {
    if (!orgId || !canManage) return;
    try { setStatus(await call("status")); } catch { setStatus({ connected: false, healthy: false }); }
  }, [orgId, canManage, call]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const r = params.get("quickbooks");
    if (!r) return;
    const [msg, kind] = RETURN_MESSAGES[r] ?? RETURN_MESSAGES.error;
    (kind === "success" ? toast.success : toast.error)(msg);
    params.delete("quickbooks");
    setParams(params, { replace: true });
  }, [params, setParams]);

  const run = async (kind: "connect" | "sync" | "disconnect") => {
    setBusy(kind);
    try {
      if (kind === "connect") {
        const { url } = await call("start");
        window.location.assign(url);
        return;
      }
      if (kind === "disconnect") {
        if (!confirm("Disconnect QuickBooks? Invoices already copied stay in QuickBooks.")) return;
        await call("disconnect");
        toast.success("QuickBooks disconnected.");
      } else {
        const { data, error } = await supabase.functions.invoke("quickbooks", { body: { organizationId: orgId } });
        if (error) throw error;
        toast[data.failed ? "error" : "success"](`${data.synced} invoice${data.synced === 1 ? "" : "s"} sent to QuickBooks${data.failed ? `, ${data.failed} failed (see below)` : ""}${data.more ? ". More to go: run it again." : "."}`);
      }
      await refresh();
    } catch (e) {
      toast.error((await readFunctionError(e, "QuickBooks request failed")).message);
    } finally {
      setBusy(null);
    }
  };

  if (!canManage) return null;
  const problems = (status?.recent ?? []).filter((r) => r.status === "error" || (r.entity_type === "invoice" && r.error && r.error !== "voided"));

  return <Card id="quickbooks">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10"><BookOpenCheck className="h-5 w-5 text-primary" aria-hidden="true" /></div>
          <div>
            <CardTitle>QuickBooks Online</CardTitle>
            <CardDescription>Invoices you send or get paid on in FastTract are copied into QuickBooks with their customer and payments. Drafts stay in FastTract.</CardDescription>
          </div>
        </div>
        {status && <Badge variant={status.connected && status.healthy ? "default" : "secondary"}>{!status.connected ? "Not connected" : status.healthy ? "Connected" : "Needs attention"}</Badge>}
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {status?.connected && <p className="text-sm">{status.companyName ? <>Company: <strong>{status.companyName}</strong></> : null}{status.error ? <span className="text-destructive"> {status.error}</span> : null}</p>}
      <div className="flex flex-wrap gap-2">
        {!status?.connected || !status.healthy
          ? <Button onClick={() => run("connect")} disabled={busy !== null}>{busy === "connect" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{status?.connected ? "Reconnect QuickBooks" : "Connect QuickBooks"}</Button>
          : <Button onClick={() => run("sync")} disabled={busy !== null}>{busy === "sync" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sync now</Button>}
        {status?.connected && <Button variant="ghost" onClick={() => run("disconnect")} disabled={busy !== null}>Disconnect</Button>}
      </div>
      {problems.length > 0 && <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
        <p className="font-medium">Recent sync notes</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">{problems.slice(0, 5).map((r, i) => <li key={i}>{new Date(r.created_at).toLocaleString()}: {r.error}</li>)}</ul>
      </div>}
    </CardContent>
  </Card>;
}
