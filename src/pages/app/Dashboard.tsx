import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase, Users, FileText, Receipt, DollarSign, Sparkles, Plus,
  ArrowRight, HardHat, UserCheck, ClipboardList,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatKey = "won_leads" | "active_jobs" | "pending_estimates" | "unpaid_invoices" | "revenue_paid";
type Stats = Record<StatKey, number>;
type JobRow = {
  id: string;
  title: string;
  status: string;
  address: string | null;
  budget: number | null;
  customers: { name: string | null } | null;
};
type LeadRow = { id: string; name: string | null; status: string | null; value: number | null };

const STAT_META: Record<StatKey, { label: string; icon: any; accent: string; to: string }> = {
  won_leads: {
    label: "Won Leads", icon: UserCheck, to: "/app/leads",
    accent: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
  },
  active_jobs: {
    label: "Active Jobs", icon: HardHat, to: "/app/jobs",
    accent: "text-amber-400 bg-amber-500/10 ring-amber-500/20",
  },
  pending_estimates: {
    label: "Pending Estimates", icon: ClipboardList, to: "/app/estimates",
    accent: "text-sky-400 bg-sky-500/10 ring-sky-500/20",
  },
  unpaid_invoices: {
    label: "Unpaid Invoices", icon: Receipt, to: "/app/invoices",
    accent: "text-rose-400 bg-rose-500/10 ring-rose-500/20",
  },
  revenue_paid: {
    label: "Revenue (Paid)", icon: DollarSign, to: "/app/invoices",
    accent: "text-primary bg-primary/10 ring-primary/25",
  },
};

const ACTIVE_JOB_STATUSES = new Set(["scheduled", "in_progress", "on_hold"]);
const currency = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n.toLocaleString()}`;
const fullCurrency = (n: number) =>
  `$${Math.round(n).toLocaleString()}`;

function statusTone(s: string | null | undefined) {
  const key = (s ?? "").toLowerCase();
  if (key === "in_progress") return "text-amber-400 bg-amber-500/10 ring-amber-500/20";
  if (key === "scheduled") return "text-sky-400 bg-sky-500/10 ring-sky-500/20";
  if (key === "completed") return "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20";
  if (key === "on_hold") return "text-rose-400 bg-rose-500/10 ring-rose-500/20";
  if (key === "new") return "text-sky-400 bg-sky-500/10 ring-sky-500/20";
  if (key === "contacted") return "text-amber-400 bg-amber-500/10 ring-amber-500/20";
  if (key === "qualified") return "text-primary bg-primary/10 ring-primary/25";
  if (key === "won") return "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20";
  return "text-muted-foreground bg-secondary ring-border";
}

export default function Dashboard() {
  const { activeOrg, user } = useAuth();
  const firstName = useMemo(() => user?.email?.split("@")[0] ?? "", [user]);
  const orgId = activeOrg?.organization_id;

  const [stats, setStats] = useState<Stats>({
    won_leads: 0, active_jobs: 0, pending_estimates: 0, unpaid_invoices: 0, revenue_paid: 0,
  });
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [pipeline, setPipeline] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [leadsRes, jobsRes, estimatesRes, invoicesRes, activeJobsRes, pipelineRes] = await Promise.all([
        supabase.from("leads").select("id,status", { count: "exact", head: false }).eq("organization_id", orgId).eq("status", "won"),
        supabase.from("jobs").select("id,status").eq("organization_id", orgId),
        supabase.from("estimates").select("id,status").eq("organization_id", orgId).in("status", ["draft", "sent"]),
        supabase.from("invoices").select("id,status,total,amount_paid").eq("organization_id", orgId),
        supabase
          .from("jobs")
          .select("id,title,status,address,budget,customers(name)")
          .eq("organization_id", orgId)
          .in("status", ["scheduled", "in_progress", "on_hold"])
          .order("scheduled_start", { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from("leads")
          .select("id,name,status,value")
          .eq("organization_id", orgId)
          .neq("status", "lost")
          .neq("status", "won")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (!alive) return;

      const activeJobsCount = (jobsRes.data ?? []).filter(j => ACTIVE_JOB_STATUSES.has(j.status)).length;
      const invoices = invoicesRes.data ?? [];
      const unpaid = invoices.filter(i => (i.total ?? 0) > (i.amount_paid ?? 0) && i.status !== "void").length;
      const revenue = invoices.reduce((sum, i) => sum + Number(i.amount_paid ?? 0), 0);

      setStats({
        won_leads: leadsRes.data?.length ?? 0,
        active_jobs: activeJobsCount,
        pending_estimates: estimatesRes.data?.length ?? 0,
        unpaid_invoices: unpaid,
        revenue_paid: revenue,
      });
      setJobs((activeJobsRes.data ?? []) as JobRow[]);
      setPipeline((pipelineRes.data ?? []) as LeadRow[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [orgId]);

  const orderedStats: StatKey[] = ["won_leads", "active_jobs", "pending_estimates", "unpaid_invoices", "revenue_paid"];

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          Operations Hub
        </div>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          Run your crew like a{" "}
          <span className="text-primary">machine.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {activeOrg?.organization.name
            ? `${activeOrg.organization.name} — track leads, estimates, jobs, invoices, materials, and payments from one command center built for contractors who move fast.`
            : "Track leads, estimates, jobs, invoices, materials, and payments — all from one command center built for contractors who move fast."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="gap-2 shadow-elevated">
            <Link to="/app/estimates">
              <Plus className="h-4 w-4" /> New Estimate
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="gap-2">
            <Link to="/app/assistant">
              <Sparkles className="h-4 w-4" /> Ask AI Estimator
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {orderedStats.map((key) => {
          const meta = STAT_META[key];
          const value = stats[key];
          const display = key === "revenue_paid" ? fullCurrency(value) : value.toString();
          return (
            <Link
              key={key}
              to={meta.to}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {meta.label}
                </div>
                <span className={cn("grid h-9 w-9 place-items-center rounded-xl ring-1", meta.accent)}>
                  <meta.icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                {loading ? <span className="text-muted-foreground">—</span> : display}
              </div>
            </Link>
          );
        })}
      </section>

      {/* Active jobs + pipeline */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Active Jobs"
          viewAllTo="/app/jobs"
          icon={Briefcase}
          empty={!loading && jobs.length === 0 ? "No active jobs yet." : undefined}
        >
          <ul className="divide-y divide-border/60">
            {jobs.map(j => (
              <li key={j.id}>
                <Link
                  to="/app/jobs"
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                    <HardHat className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{j.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[j.customers?.name, j.address].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="text-sm font-semibold">
                      {j.budget != null ? fullCurrency(Number(j.budget)) : "—"}
                    </div>
                  </div>
                  <span className={cn("hidden rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 sm:inline-flex", statusTone(j.status))}>
                    {j.status.replace("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Pipeline"
          viewAllTo="/app/leads"
          icon={Sparkles}
          empty={!loading && pipeline.length === 0 ? "No open leads." : undefined}
        >
          <ul className="divide-y divide-border/60">
            {pipeline.map(l => (
              <li key={l.id}>
                <Link
                  to="/app/leads"
                  className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name || "Unnamed lead"}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.value != null ? currency(Number(l.value)) : "No value set"}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1", statusTone(l.status))}>
                    {l.status ?? "new"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title, viewAllTo, icon: Icon, empty, children,
}: {
  title: string;
  viewAllTo: string;
  icon: any;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <Link
          to={viewAllTo}
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
        >
          View all <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      {empty ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        children
      )}
    </div>
  );
}
