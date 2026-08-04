import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Building2, CircleDollarSign, CpuIcon, Users } from "lucide-react";
import { StripeWebhookHealth } from "@/components/StripeWebhookHealth";

type Stat = { label: string; value: string; sub?: string; icon: any; accent?: string };

export default function SuperOverview() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentOrgs, setRecentOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [orgs, subs, ai, users] = await Promise.all([
        supabase.from("organizations").select("id,name,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(6),
        supabase.from("subscriptions").select("status,tier,environment", { count: "exact" }),
        supabase.from("ai_usage").select("estimated_cost_usd,created_at").gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const activeSubs = (subs.data ?? []).filter((s: any) => ["active", "trialing"].includes(s.status)).length;
      const aiCost = (ai.data ?? []).reduce((a: number, r: any) => a + Number(r.estimated_cost_usd ?? 0), 0);
      setStats([
        { label: "Organizations", value: String(orgs.count ?? 0), icon: Building2, accent: "text-indigo-300" },
        { label: "Users", value: String(users.count ?? 0), icon: Users, accent: "text-sky-300" },
        { label: "Active subs", value: String(activeSubs), sub: `${subs.count ?? 0} total`, icon: CircleDollarSign, accent: "text-emerald-300" },
        { label: "AI spend / 30d", value: `$${aiCost.toFixed(2)}`, icon: CpuIcon, accent: "text-fuchsia-300" },
      ]);
      setRecentOrgs(orgs.data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-primary/80">Backend / Root</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ops Overview</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Live snapshot of the FastTract platform. Everything here is scoped to platform admins only.
          </p>
        </div>
        <Badge className="border-primary/40 bg-primary/15 text-primary">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Systems nominal
        </Badge>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 bg-card/70 p-5 backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-foreground/60">{s.label}</div>
                <div className="mt-2 text-3xl font-semibold">{loading ? "—" : s.value}</div>
                {s.sub && <div className="mt-1 text-xs text-foreground/50">{s.sub}</div>}
              </div>
              <s.icon className={`h-5 w-5 ${s.accent ?? "text-primary"}`} />
            </div>
          </Card>
        ))}
      </div>

      <StripeWebhookHealth />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/70 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Recent organizations</div>
            <Link to="/super/orgs" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border/60">
            {recentOrgs.map((o) => (
              <Link
                key={o.id}
                to={`/admin/organizations/${o.id}`}
                className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
              >
                <span className="truncate">{o.name}</span>
                <span className="flex items-center gap-2 text-xs text-foreground/50">
                  {new Date(o.created_at).toLocaleDateString()}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
            {!loading && recentOrgs.length === 0 && (
              <div className="py-8 text-center text-sm text-foreground/50">No organizations yet.</div>
            )}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/70 p-5">
          <div className="text-sm font-medium">Quick jumps</div>
          <div className="mt-3 grid gap-2 text-sm">
            {[
              { to: "/super/controls", label: "Open control panel" },
              { to: "/admin/users", label: "Manage users" },
              { to: "/admin/ai-usage", label: "AI usage & costs" },
              { to: "/admin/audit", label: "Audit log" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 hover:border-primary/50 hover:text-primary"
              >
                {l.label}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
