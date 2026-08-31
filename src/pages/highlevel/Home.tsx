import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileText,
  Mic,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHighLevel } from "@/contexts/HighLevelContext";
import {
  highLevel,
  type FastTractLead,
  type HighLevelEstimate,
  type HighLevelRecord,
} from "@/integrations/highlevel/client";
import { useBrowserSpeech } from "@/hooks/useBrowserSpeech";
import { cn } from "@/lib/utils";

type LoadState = {
  leads: FastTractLead[];
  estimates: HighLevelEstimate[];
  jobs: HighLevelRecord[];
  warnings: string[];
};

const emptyState: LoadState = { leads: [], estimates: [], jobs: [], warnings: [] };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function jobStatus(record: HighLevelRecord) {
  const properties = record.properties ?? {};
  for (const key of ["custom_objects.jobs.status", "custom_object.jobs.status", "status"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.toLowerCase();
  }
  return "scheduled";
}

function jobName(record: HighLevelRecord) {
  const properties = record.properties ?? {};
  const keys = [
    "custom_objects.jobs.job_name",
    "custom_object.jobs.job_name",
    "job_name",
    "name",
    "title",
  ];
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "Untitled job";
}

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
      highLevel.listRecords("jobs", { limit: 100 }),
    ]);

    const warnings: string[] = [];
    const leadResult = results[0];
    const estimateResult = results[1];
    const jobResult = results[2];

    if (leadResult.status === "rejected") warnings.push("Leads are temporarily unavailable.");
    if (estimateResult.status === "rejected") warnings.push("Estimate totals are temporarily unavailable.");
    if (jobResult.status === "rejected") warnings.push("Jobs need to be initialized for this sub-account.");

    setData({
      leads: leadResult.status === "fulfilled" ? leadResult.value.leads ?? [] : [],
      estimates: estimateResult.status === "fulfilled" ? estimateResult.value.estimates ?? [] : [],
      jobs: jobResult.status === "fulfilled" ? jobResult.value.records ?? [] : [],
      warnings,
    });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const openLeads = data.leads.filter((lead) => !["won", "lost"].includes(lead.status));
    const drafts = data.estimates.filter((estimate) => estimate.status === "draft");
    const awaiting = data.estimates.filter((estimate) => ["sent", "viewed"].includes(estimate.status ?? ""));
    const pipelineValue = data.estimates
      .filter((estimate) => !["declined"].includes(estimate.status ?? ""))
      .reduce((sum, estimate) => sum + (Number(estimate.total) || 0), 0);
    const activeJobs = data.jobs.filter((job) => !["complete", "completed", "cancelled"].includes(jobStatus(job))).length;
    return { openLeads, drafts, awaiting, pipelineValue, activeJobs };
  }, [data]);

  const submitCommand = (event: FormEvent) => {
    event.preventDefault();
    const text = command.trim();
    if (!text) return;
    navigate(`/highlevel/ai?prompt=${encodeURIComponent(text)}`);
  };

  const urgentLead = stats.openLeads.find((lead) => lead.status === "qualified") ?? stats.openLeads[0];
  const draftEstimate = stats.drafts[0];
  const awaitingEstimate = stats.awaiting[0];
  const nextJob = data.jobs.find((job) => !["complete", "completed", "cancelled"].includes(jobStatus(job))) ?? data.jobs[0];

  return (
    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_330px]">
      <section className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FastTract workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{firstName}&apos;s day</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        <form onSubmit={submitCommand} className="mt-7 flex min-w-0 items-center gap-2 rounded-2xl border border-primary/25 bg-card p-2 shadow-card focus-within:ring-2 focus-within:ring-primary">
          <Sparkles className="ml-3 h-5 w-5 shrink-0 text-primary" />
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="h-12 min-w-0 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            placeholder="Ask FastTract to handle anything…"
            aria-label="Ask FastTract"
          />
          <Button type="button" size="icon" variant="ghost" aria-label={voice.listening ? "Stop voice input" : "Use voice"} onClick={voice.listening ? voice.stop : voice.start}>
            <Mic className={cn("h-5 w-5", voice.listening && "animate-pulse text-primary")} />
          </Button>
          <Button type="submit" size="icon" aria-label="Send to FastTract" disabled={!command.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Open leads" value={loading ? "—" : String(stats.openLeads.length)} icon={Users} to="/highlevel/leads" />
          <StatCard label="Draft estimates" value={loading ? "—" : String(stats.drafts.length)} icon={FileText} to="/highlevel/estimates" />
          <StatCard label="Active jobs" value={loading ? "—" : String(stats.activeJobs)} icon={BriefcaseBusiness} to="/highlevel/jobs" />
          <StatCard label="Estimate value" value={loading ? "—" : money.format(stats.pipelineValue)} icon={WalletCards} to="/highlevel/money" />
        </div>

        {data.warnings.length > 0 && (
          <div className="mt-5 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-muted-foreground">
            {data.warnings.join(" ")}
          </div>
        )}

        <div className="mt-8 space-y-7">
          <RunSection title="Now">
            {urgentLead ? (
              <ActionRow
                icon={CircleAlert}
                title={`${urgentLead.name} needs follow-up`}
                detail={[urgentLead.status, urgentLead.phone || urgentLead.email].filter(Boolean).join(" · ")}
                status="Needs attention"
                statusClass="text-amber-400"
                actionLabel="Open leads"
                to="/highlevel/leads"
              />
            ) : (
              <ActionRow
                icon={CheckCircle2}
                title="No urgent lead follow-up"
                detail="FastTract did not find an open lead requiring immediate attention."
                status="Clear"
                statusClass="text-emerald-400"
                actionLabel="View leads"
                to="/highlevel/leads"
              />
            )}
          </RunSection>

          <RunSection title="Next">
            {draftEstimate ? (
              <ActionRow
                icon={FileText}
                title={`Estimate draft: ${draftEstimate.name || "Untitled estimate"}`}
                detail={`${draftEstimate.contactDetails?.name || "Customer not assigned"} · ${money.format(Number(draftEstimate.total) || 0)}`}
                status="Ready for review"
                statusClass="text-amber-400"
                actionLabel="Review"
                to={`/highlevel/estimates?edit=${encodeURIComponent(draftEstimate._id)}`}
              />
            ) : (
              <ActionRow
                icon={Sparkles}
                title="Create the next estimate with Ava"
                detail="Describe the job in plain language and FastTract will prepare the draft for your review."
                status="Ready"
                statusClass="text-primary"
                actionLabel="Start estimate"
                to="/highlevel/ai?prompt=Build%20an%20estimate%20for%20"
              />
            )}
          </RunSection>

          <RunSection title="Later">
            {awaitingEstimate && (
              <ActionRow
                icon={CalendarClock}
                title={`Waiting on ${awaitingEstimate.contactDetails?.name || "customer"}`}
                detail={`${awaitingEstimate.name} · ${money.format(Number(awaitingEstimate.total) || 0)}`}
                status={awaitingEstimate.status === "viewed" ? "Viewed" : "Sent"}
                statusClass="text-sky-400"
                actionLabel="Open"
                to={`/highlevel/estimates?edit=${encodeURIComponent(awaitingEstimate._id)}`}
              />
            )}
            {nextJob && (
              <ActionRow
                icon={BriefcaseBusiness}
                title={jobName(nextJob)}
                detail="Open the job workspace for crew, materials, notes, and status."
                status="Job"
                statusClass="text-primary"
                actionLabel="Open job"
                to="/highlevel/jobs"
              />
            )}
            {!awaitingEstimate && !nextJob && (
              <ActionRow
                icon={CheckCircle2}
                title="Nothing waiting in the queue"
                detail="Sent estimates and active jobs will appear here automatically."
                status="Up to date"
                statusClass="text-emerald-400"
                actionLabel="Open money"
                to="/highlevel/money"
              />
            )}
          </RunSection>
        </div>
      </section>

      <aside className="hidden border-l border-border bg-card/25 p-6 lg:block">
        <div className="sticky top-24">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <span className="flex items-center gap-2 font-semibold"><Bot className="h-5 w-5 text-primary" /> Ava</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Online</span>
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
                <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Ready</span>
              </div>
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Good to see you, {firstName}.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              I am connected to this HighLevel sub-account and ready to help with leads, jobs, estimates, and follow-up.
            </p>
            <Button className="mt-5 w-full" asChild>
              <Link to="/highlevel/ai">Open Ava <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="py-6">
            <h3 className="text-sm font-semibold">Common requests</h3>
            <div className="mt-3 space-y-2">
              {[
                "Build an estimate from my job notes",
                "Show me the leads that need a callback",
                "What money is still outstanding?",
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

function StatCard({ label, value, icon: Icon, to }: { label: string; value: string; icon: typeof Users; to: string }) {
  return (
    <Link to={to} className="min-w-0 rounded-xl border border-border bg-card/50 p-4 shadow-card transition-colors hover:bg-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </div>
      <p className="mt-2 truncate text-xl font-semibold">{value}</p>
    </Link>
  );
}

function RunSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><span className="h-2 w-2 rounded-full bg-primary" />{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40">{children}</div>
    </section>
  );
}

function ActionRow({
  icon: Icon,
  title,
  detail,
  status,
  statusClass,
  actionLabel,
  to,
}: {
  icon: typeof Users;
  title: string;
  detail: string;
  status: string;
  statusClass: string;
  actionLabel: string;
  to: string;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
        <span className={cn("text-xs font-medium", statusClass)}>{status}</span>
        <Button size="sm" variant="outline" asChild><Link to={to}>{actionLabel}</Link></Button>
      </div>
    </div>
  );
}
