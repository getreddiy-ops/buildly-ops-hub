import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";

type Action = {
  id: string; action_type: string; status: string; created_at: string;
  payload: any; result: any;
  organizations: { name: string } | null;
};

type AdminEvent = {
  id: string; created_at: string; admin_email: string | null; target_email: string | null;
  action: string; path: string | null; details: any; session_id: string | null;
};

export default function AdminAudit() {
  const [items, setItems] = useState<Action[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: actions }, { data: adminEvents }] = await Promise.all([
        supabase
          .from("ai_actions")
          .select("id, action_type, status, created_at, payload, result, organizations(name)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("admin_audit_log")
          .select("id, created_at, admin_email, target_email, action, path, details, session_id")
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
      setItems((actions ?? []) as any);
      setEvents((adminEvents ?? []) as any);
    })();
  }, []);

  return (
    <>
      <PageHeader title="Audit Log" description="Admin support sessions and AI-driven actions across the platform." />
      <Tabs defaultValue="support">
        <TabsList className="mb-4">
          <TabsTrigger value="support">Admin support</TabsTrigger>
          <TabsTrigger value="ai">AI actions</TabsTrigger>
        </TabsList>

        <TabsContent value="support">
          {events.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No support activity yet" description="Entering a client account from the Client Workspace will record events here." />
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {events.map((e) => (
                <div key={e.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{e.action}</span>
                      {e.path && <span className="font-mono text-xs text-muted-foreground">{e.path}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground break-words">
                      {e.admin_email ?? "admin"} → {e.target_email ?? "—"} · {new Date(e.created_at).toLocaleString()}
                      {e.details && Object.keys(e.details).length > 0 ? ` · ${JSON.stringify(e.details)}` : ""}
                    </div>
                  </div>
                  <Badge
                    className="self-start shrink-0"
                    variant={e.action === "impersonation_start" ? "default" : e.action === "impersonation_end" ? "secondary" : "outline"}
                  >
                    {e.action.startsWith("impersonation") ? "session" : "activity"}
                  </Badge>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai">
          {items.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No events yet" description="AI Assistant proposals and approvals will show here." />
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {items.map((a) => (
                <div key={a.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1 order-2 sm:order-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm break-words">{a.action_type}</span>
                      <span className="text-xs text-muted-foreground">· {a.organizations?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">· {new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto whitespace-pre-wrap break-all max-w-full">
                      {JSON.stringify(a.payload)}
                    </pre>
                  </div>
                  <Badge className="self-start order-1 sm:order-2 shrink-0" variant={a.status === "executed" ? "default" : a.status === "rejected" ? "secondary" : "outline"}>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
