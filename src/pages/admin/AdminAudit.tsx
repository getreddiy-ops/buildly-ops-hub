import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";

type Action = {
  id: string; action_type: string; status: string; created_at: string;
  payload: any; result: any;
  organizations: { name: string } | null;
};

export default function AdminAudit() {
  const [items, setItems] = useState<Action[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ai_actions")
        .select("id, action_type, status, created_at, payload, result, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setItems((data ?? []) as any);
    })();
  }, []);

  return (
    <>
      <PageHeader title="Audit Log" description="AI-driven actions across the platform." />
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
    </>
  );
}
