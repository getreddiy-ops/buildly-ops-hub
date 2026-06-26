import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Org = { id: string; name: string; plan: string; created_at: string; agent_id: string | null };

export default function AdminOrgs() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("organizations").select("id, name, plan, created_at, agent_id").order("created_at", { ascending: false });
      setOrgs((data ?? []) as Org[]);
    })();
  }, []);

  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Organizations" description="Every contractor on the platform." />
      <Input placeholder="Search organizations…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-4" />
      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No organizations" />
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((o) => (
            <div key={o.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">
                  Joined {new Date(o.created_at).toLocaleDateString()}
                  {o.agent_id && " · has agent"}
                </div>
              </div>
              <Badge variant="outline">{o.plan}</Badge>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
