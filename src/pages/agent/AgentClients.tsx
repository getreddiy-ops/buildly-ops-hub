import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Org = {
  id: string; name: string; plan: string; created_at: string;
  customers: { count: number }[];
  jobs: { count: number }[];
};

export default function AgentClients() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name, plan, created_at, customers(count), jobs(count)")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });
      setOrgs((data ?? []) as any);
      setLoading(false);
    })();
  }, [user]);

  return (
    <>
      <PageHeader title="Client Organizations" description="Contractors you manage." />
      {loading ? null : orgs.length === 0 ? (
        <EmptyState icon={Building2} title="No clients yet" description="Organizations that assign you as their agent will show up here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => (
            <Card key={o.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{o.name}</h3>
                  <p className="text-xs text-muted-foreground">Joined {new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline">{o.plan}</Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <div><span className="text-muted-foreground">Customers:</span> {o.customers?.[0]?.count ?? 0}</div>
                <div><span className="text-muted-foreground">Jobs:</span> {o.jobs?.[0]?.count ?? 0}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
