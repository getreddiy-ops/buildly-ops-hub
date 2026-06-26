import { useEffect, useState } from "react";
import { Building2, Users, DollarSign, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AgentOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ orgs: 0, jobs: 0, customers: 0, leadsShared: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: orgs } = await supabase.from("organizations").select("id").eq("agent_id", user.id);
      const ids = (orgs ?? []).map((o) => o.id);
      if (ids.length === 0) {
        setStats({ orgs: 0, jobs: 0, customers: 0, leadsShared: 0 });
        return;
      }
      const [jobs, custs, leads] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).in("organization_id", ids),
        supabase.from("customers").select("id", { count: "exact", head: true }).in("organization_id", ids),
        supabase.from("leads").select("id", { count: "exact", head: true }).in("organization_id", ids),
      ]);
      setStats({ orgs: ids.length, jobs: jobs.count ?? 0, customers: custs.count ?? 0, leadsShared: leads.count ?? 0 });
    })();
  }, [user]);

  const cards = [
    { label: "Client Orgs", value: stats.orgs, icon: Building2 },
    { label: "Customers", value: stats.customers, icon: Users },
    { label: "Active Jobs", value: stats.jobs, icon: TrendingUp },
    { label: "Leads Shared", value: stats.leadsShared, icon: DollarSign },
  ];

  return (
    <>
      <PageHeader title="Agent Overview" description="Your reseller dashboard at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold">{c.value}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
