import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Briefcase, Users, FileText, Receipt, ClipboardCheck,
  ArrowRight, CalendarClock, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Job = Database["public"]["Tables"]["jobs"]["Row"] & { customers?: { name: string } | null };
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { customers?: { name: string } | null };
type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers?: { name: string } | null };

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

function StatTile({ label, value, to, icon: Icon }: { label: string; value: string | number; to: string; icon: typeof Briefcase }) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-secondary/40">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [followUpLeads, setFollowUpLeads] = useState<Lead[]>([]);
  const [awaitingEstimates, setAwaitingEstimates] = useState<Estimate[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const firstName = useMemo(() => {
    const full = user?.user_metadata?.full_name as string | undefined;
    return full?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  }, [user]);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [],
  );

  useEffect(() => {
    if (!activeOrg) return;
    const orgId = activeOrg.organization_id;
    setLoading(true);
    (async () => {
      const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayIso = new Date().toISOString().slice(0, 10);
      const [jobsRes, activeJobsRes, leadsRes, estimatesRes, invoicesRes, approvalsRes] = await Promise.all([
        supabase.from("jobs").select("*, customers(name)").eq("organization_id", orgId)
          .not("scheduled_start", "is", null).lte("scheduled_start", weekAhead)
          .not("status", "in", "(cancelled,completed)")
          .order("scheduled_start", { ascending: true }).limit(6),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("organization_id", orgId)
          .in("status", ["scheduled", "in_progress"]),
        supabase.from("leads").select("*").eq("organization_id", orgId)
          .in("status", ["new", "contacted"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("estimates").select("*, customers(name)").eq("organization_id", orgId)
          .eq("status", "sent").order("updated_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("*, customers(name)").eq("organization_id", orgId)
          .in("status", ["sent", "overdue"]).order("due_date", { ascending: true }).limit(20),
        isAdmin
          ? supabase.from("time_entries").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "pending")
          : Promise.resolve({ count: 0 }),
      ]);
      setUpcomingJobs((jobsRes.data ?? []) as Job[]);
      setActiveJobCount(activeJobsRes.count ?? 0);
      setFollowUpLeads(leadsRes.data ?? []);
      setAwaitingEstimates((estimatesRes.data ?? []) as Estimate[]);
      const invoices = (invoicesRes.data ?? []) as Invoice[];
      const overdue = invoices.filter((inv) => inv.status === "overdue" || (!!inv.due_date && inv.due_date < todayIso));
      setOverdueInvoices(overdue.slice(0, 5));
      setUnpaidTotal(invoices.reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid)), 0));
      setPendingApprovals(approvalsRes.count ?? 0);
      setLoading(false);
    })();
  }, [activeOrg?.organization_id, isAdmin]);

  const attentionItems = [
    ...(isAdmin && pendingApprovals > 0
      ? [{ key: "approvals", to: "/app/approvals", icon: ClipboardCheck,
          title: `${pendingApprovals} time entr${pendingApprovals === 1 ? "y" : "ies"} awaiting approval`, detail: "Review and approve crew hours" }]
      : []),
    ...overdueInvoices.map((inv) => ({
      key: `inv-${inv.id}`, to: `/app/invoices`, icon: Receipt,
      title: `Overdue invoice${inv.number ? ` #${inv.number}` : ""} — ${fmt(Number(inv.total) - Number(inv.amount_paid))}`,
      detail: inv.customers?.name ?? "No customer on file",
    })),
    ...followUpLeads.map((lead) => ({
      key: `lead-${lead.id}`, to: "/app/leads", icon: Users,
      title: `Follow up with ${lead.name}`, detail: lead.source ? `Source: ${lead.source}` : "New lead",
    })),
    ...awaitingEstimates.map((est) => ({
      key: `est-${est.id}`, to: `/app/estimates`, icon: FileText,
      title: `Estimate "${est.title}" awaiting response`, detail: est.customers?.name ?? "No customer on file",
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`${firstName}'s day`} description={todayLabel} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Active jobs" value={activeJobCount} to="/app/jobs" icon={Briefcase} />
        <StatTile label="Leads to follow up" value={followUpLeads.length} to="/app/leads" icon={Users} />
        <StatTile label="Estimates awaiting reply" value={awaitingEstimates.length} to="/app/estimates" icon={FileText} />
        <StatTile label="Unpaid invoices" value={fmt(unpaidTotal)} to="/app/invoices" icon={Receipt} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4 text-primary" /> Today & this week</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/app/jobs">All jobs <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : upcomingJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {upcomingJobs.map((job) => (
                <Link key={job.id} to="/app/jobs" className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3 text-sm hover:bg-secondary/40">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{job.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{job.customers?.name ?? "No customer"}</div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {job.scheduled_start ? new Date(job.scheduled_start).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "—"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Needs your attention</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : attentionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <div className="space-y-2">
              {attentionItems.slice(0, 8).map((item) => (
                <Link key={item.key} to={item.to} className="flex items-center gap-3 rounded-md border border-border/60 p-3 text-sm hover:bg-secondary/40">
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Ask Ava</div>
            <div className="text-sm text-muted-foreground">Ask about your business, or have Ava draft a lead, estimate, or job for your approval.</div>
          </div>
        </div>
        <Button asChild><Link to="/app/assistant">Open Ask Ava <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
      </Card>
    </div>
  );
}
