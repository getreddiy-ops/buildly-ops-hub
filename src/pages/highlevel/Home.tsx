import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeDollarSign,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Flame,
  Mic,
  Receipt,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHighLevel } from "@/contexts/HighLevelContext";
import { useBrowserSpeech } from "@/hooks/useBrowserSpeech";
import {
  highLevel,
  type FastTractLead,
  type HighLevelEstimate,
  type HighLevelInvoice,
  type HighLevelRecord,
} from "@/integrations/highlevel/client";
import {
  buildHighLevelDashboard,
  type DashboardTask,
  type DashboardTaskKind,
  type DashboardTone,
} from "@/lib/highlevelDashboard";
import { cn } from "@/lib/utils";

type LoadState = {
  leads: FastTractLead[];
  estimates: HighLevelEstimate[];
  invoices: HighLevelInvoice[];
  jobs: HighLevelRecord[];
  warnings: string[];
  refreshedAt: Date | null;
};

const emptyState: LoadState = {
  leads: [],
  estimates: [],
  invoices: [],
  jobs: [],
  warnings: [],
  refreshedAt: null,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const taskIcons: Record<DashboardTaskKind, LucideIcon> = {
  lead: Users,
  estimate: FileText,
  invoice: Receipt,
  job: BriefcaseBusiness,
};

const toneText: Record<DashboardTone, string> = {
  critical: "text-destructive",
  warning: "text-amber-400",
  primary: "text-primary",
  info: "text-sky-400",
  success: "text-emerald-400",
  muted: "text-muted-foreground",
};

const toneSurface: Record<DashboardTone, string> = {
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-amber-400/10 text-amber-400",
  primary: "bg-primary/10 text-primary",
  info: "bg-sky-400/10 text-sky-400",
  success: "bg-emerald-400/10 text-emerald-400",
  muted: "bg-muted/50 text-muted-foreground",
};

export default function HighLevelHome() {
  const { firstName } = useHighLevel();
  const navigate = useNavigate();
  const [data, setData] = useState<LoadState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const voice = useBrowserSpeech((transcript) => {
    setCommand((current) => [current.trim(), transcript].filter(Boolean).join(" "));
  });

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      highLevel.listLeads({ limit: 100 }),
      highLevel.listEstimates({ limit: 100, status: "all" }),
      highLevel.listInvoices({ limit: 100, status: "all" }),
      highLevel.listRecords("jobs", { limit: 100 }),
    ]);

    const warnings: string[] = [];
    const leadResult = results[0];
    const estimateResult = results[1];
    const invoiceResult = results[2];
    const jobResult = results[3];

    if (leadResult.status === "rejected") warnings.push("Leads are temporarily unavailable.");
    if (estimateResult.status === "rejected") warnings.push("Estimate totals are temporarily unavailable.");
    if (invoiceResult.status === "rejected") warnings.push("Invoice balances are temporarily unavailable.");
    if (jobResult.status === "rejected") warnings.push("Jobs need to be initialized for this sub-account.");

    setData({
      leads: leadResult.status === "fulfilled" ? leadResult.value.leads ?? [] : [],
      estimates: estimateResult.status === "fulfilled" ? estimateResult.value.estimates ?? [] : [],
      invoices: invoiceResult.status === "fulfilled" ? invoiceResult.value.invoices ?? [] : [],
      jobs: jobResult.status === "fulfilled" ? jobResult.value.records ?? [] : [],
      warnings,
      refreshedAt: new Date(),
    });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const dashboard = useMemo(() => buildHighLevelDashboard({
    leads: data.leads,
    estimates: data.estimates,
    invoices: data.invoices,
    jobs: data.jobs,
  }), [data.estimates, data.invoices, data.jobs, data.leads]);

  const submitCommand = (event: FormEvent) => {
    event.preventDefault();
    const text = command.trim();
    if (!text) return;
    navigate(`/highlevel/ai?prompt=${encodeURIComponent(text)}`);
  };

  const attentionCount = dashboard.now.length + dashboard.next.length;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const refreshedLabel = data.refreshedAt
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(data.refreshedAt)
    : "Not refreshed yet";

  return (
    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your Day</p>
              {!loading && attentionCount === 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All caught up
                </span>
              )}
            </div>
            <h1 className="mt-2 truncate text-3xl font-bold tracking-tight sm:text-4xl">Good morning, {firstName}.</h1>
            <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <span className="text-[11px] text-muted-foreground">Updated {refreshedLabel}</span>
          </div>
        </div>

        <form
          onSubmit={submitCommand}
          className="mt-7 flex min-w-0 items-center gap-2 rounded-2xl border border-primary/25 bg-card p-2 shadow-card focus-within:ring-2 focus-within:ring-primary"
        >
          <Sparkles className="ml-3 h-5 w-5 shrink-0 text-primary" />
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="h-12 min-w-0 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            placeholder="Ask FastTract to handle anything…"
            aria-label="Ask FastTract"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={voice.listening ? "Stop voice input" : "Use voice"}
            onClick={voice.listening ? voice.stop : voice.start}
          >
            <Mic className={cn("h-5 w-5", voice.listening && "animate-pulse text-primary")} />
          </Button>
          <Button type="submit" size="icon" aria-label="Send to FastTract" disabled={!command.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Open leads"
            value={loading ? "—" : String(dashboard.metrics.openLeads)}
            detail={loading ? "Loading" : `${dashboard.metrics.hotLeads} qualified`}
            icon={Users}
            to="/highlevel/leads"
            alert={dashboard.metrics.hotLeads > 0}
          />
          <StatCard
            label="Active jobs"
            value={loading ? "—" : String(dashboard.metrics.activeJobs)}
            detail="Current and scheduled work"
            icon={BriefcaseBusiness}
            to="/highlevel/jobs"
          />
          <StatCard
            label="Ready to invoice"
            value={loading ? "—" : money.format(dashboard.metrics.readyToInvoiceValue)}
            detail={`${dashboard.metrics.draftEstimates} estimate draft${dashboard.metrics.draftEstimates === 1 ? "" : "s"}`}
            icon={BadgeDollarSign}
            to="/highlevel/money"
            alert={dashboard.metrics.readyToInvoiceValue > 0}
          />
          <StatCard
            label="Outstanding"
            value={loading ? "—" : money.format(dashboard.metrics.outstandingInvoiceValue)}
            detail={dashboard.metrics.overdueInvoiceValue > 0
              ? `${money.format(dashboard.metrics.overdueInvoiceValue)} overdue`
              : "No overdue balance"}
            icon={WalletCards}
            to="/highlevel/money"
            alert={dashboard.metrics.overdueInvoiceValue > 0}
          />
        </div>

        {data.warnings.length > 0 && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-muted-foreground">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{data.warnings.join(" ")}</span>
          </div>
        )}

        <div className="mt-9 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Priority queue</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">What moves the business forward</h2>
          </div>
          <p className="text-xs text-muted-foreground">FastTract ranks money, customers, and jobs together.</p>
        </div>

        <div className="mt-5 space-y-7">
          <TaskLane
            title="Now"
            description="Needs your attention first"
            tasks={dashboard.now}
            loading={loading}
            emptyTitle="Nothing urgent right now"
            emptyDetail="New leads, overdue invoices, accepted estimates, and active jobs will appear here."
          />
          <TaskLane
            title="Next"
            description="Ready to move forward"
            tasks={dashboard.next}
            loading={loading}
            emptyTitle="No next actions waiting"
            emptyDetail="Estimate drafts, near-due invoices, and upcoming work will show here."
          />
          <TaskLane
            title="Later"
            description="Keep an eye on these"
            tasks={dashboard.later}
            loading={loading}
            emptyTitle="The later queue is clear"
            emptyDetail="Customer decisions and future jobs will appear automatically."
          />
        </div>
      </section>

      <aside className="hidden border-l border-border bg-card/25 p-6 lg:block">
        <div className="sticky top-24">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <span className="flex items-center gap-2 font-semibold"><Bot className="h-5 w-5 text-primary" /> Ava</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Connected</span>
          </div>

          <div className="border-b border-border py-6">
            <div className="relative h-40 overflow-hidden rounded-2xl border border-primary/20 bg-background shadow-card">
              <img
                src="/ava-onboarding.png"
                alt="Ava, the FastTract assistant"
                className="h-full w-full object-cover object-[center_28%]"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-background via-background/80 to-transparent px-4 pb-3 pt-10">
                <span className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Ava</span>
                <span className="text-xs text-muted-foreground">HighLevel connected</span>
              </div>
            </div>

            <h2 className="mt-5 text-2xl font-semibold">
              {loading ? "Checking your business…" : attentionCount > 0 ? `${attentionCount} things can move today.` : "Your queue is clear."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {loading
                ? "I am loading this sub-account’s leads, jobs, estimates, and invoices."
                : "I ranked the work by customer urgency, job timing, and money waiting to move."}
            </p>
            <Button className="mt-5 w-full" asChild>
              <Link to={`/highlevel/ai?prompt=${encodeURIComponent(dashboard.recommendedPrompt)}`}>
                Handle the next move <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="border-b border-border py-6">
            <h3 className="text-sm font-semibold">Business pulse</h3>
            <div className="mt-4 space-y-3">
              <PulseRow icon={Flame} label="Qualified leads" value={String(dashboard.metrics.hotLeads)} alert={dashboard.metrics.hotLeads > 0} />
              <PulseRow icon={Clock3} label="Waiting on customers" value={String(dashboard.metrics.waitingEstimates)} />
              <PulseRow icon={FileText} label="Estimate pipeline" value={money.format(dashboard.metrics.estimatePipelineValue)} />
              <PulseRow icon={Receipt} label="Overdue invoices" value={money.format(dashboard.metrics.overdueInvoiceValue)} alert={dashboard.metrics.overdueInvoiceValue > 0} />
            </div>
          </div>

          <div className="py-6">
            <h3 className="text-sm font-semibold">Common requests</h3>
            <div className="mt-3 space-y-2">
              {[
                "Build an estimate from my job notes",
                "Show me the leads that need a callback",
                "What money should I collect first?",
              ].map((text) => (
                <Link
                  key={text}
                  to={`/highlevel/ai?prompt=${encodeURIComponent(text)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3 text-sm transition-colors hover:bg-secondary"
                >
                  <span>{text}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  to,
  alert = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  to: string;
  alert?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "min-w-0 rounded-xl border bg-card/50 p-4 shadow-card transition-colors hover:bg-card",
        alert ? "border-primary/35" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4 shrink-0", alert ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="mt-2 truncate text-xl font-semibold">{value}</p>
      <p className={cn("mt-1 truncate text-[11px]", alert ? "text-primary" : "text-muted-foreground")}>{detail}</p>
    </Link>
  );
}

function TaskLane({
  title,
  description,
  tasks,
  loading,
  emptyTitle,
  emptyDetail,
}: {
  title: string;
  description: string;
  tasks: DashboardTask[];
  loading: boolean;
  emptyTitle: string;
  emptyDetail: string;
}) {
  const visible = tasks.slice(0, 5);
  const remaining = Math.max(tasks.length - visible.length, 0);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><span className="h-2 w-2 rounded-full bg-primary" />{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {!loading && tasks.length > 0 && <span className="text-xs text-muted-foreground">{tasks.length} item{tasks.length === 1 ? "" : "s"}</span>}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">
        {loading ? (
          [0, 1].map((item) => <div key={item} className="h-24 animate-pulse bg-muted/20" />)
        ) : visible.length > 0 ? (
          <>
            {visible.map((task) => <TaskRow key={task.id} task={task} />)}
            {remaining > 0 && (
              <div className="px-4 py-3 text-center text-xs text-muted-foreground">{remaining} more item{remaining === 1 ? "" : "s"} available in the related workspace</div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-3 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></div>
            <div>
              <h4 className="font-medium">{emptyTitle}</h4>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{emptyDetail}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TaskRow({ task }: { task: DashboardTask }) {
  const Icon = taskIcons[task.kind];
  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", toneSurface[task.tone])}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold">{task.title}</h4>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.detail}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
        <span className={cn("text-xs font-medium capitalize", toneText[task.tone])}>{task.status}</span>
        <Button size="sm" variant="outline" asChild><Link to={task.to}>{task.actionLabel}</Link></Button>
      </div>
    </div>
  );
}

function PulseRow({ icon: Icon, label, value, alert = false }: { icon: LucideIcon; label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", alert ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground")}><Icon className="h-4 w-4" /></div>
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">{label}</span>
      <span className={cn("max-w-32 truncate text-sm font-semibold", alert && "text-primary")}>{value}</span>
    </div>
  );
}
