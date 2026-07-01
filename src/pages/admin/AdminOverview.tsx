import { useEffect, useState } from "react";
import { Building2, Users, Bot, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function AdminOverview() {
  const [stats, setStats] = useState({ orgs: 0, users: 0, jobs: 0, actions: 0 });

  useEffect(() => {
    (async () => {
      const [o, u, j, a] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("ai_actions").select("id", { count: "exact", head: true }),
      ]);
      setStats({ orgs: o.count ?? 0, users: u.count ?? 0, jobs: j.count ?? 0, actions: a.count ?? 0 });
    })();
  }, []);

  const cards = [
    { label: "Organizations", value: stats.orgs, icon: Building2 },
    { label: "Users", value: stats.users, icon: Users },
    { label: "Jobs", value: stats.jobs, icon: Briefcase },
    { label: "AI Actions", value: stats.actions, icon: Bot },
  ];

  return (
    <>
      <PageHeader title="Platform Overview" description="A bird's-eye view of every organization on FastTract." />
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
