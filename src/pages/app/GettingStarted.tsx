import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarCheck, CalendarDays, CheckCircle2, Circle, Clock, FileText, FolderOpen,
  HardHat, Receipt, Sparkles, Sun, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSetupFacts } from "@/hooks/useSetupFacts";
import { computeProgress, loadManual, saveManual, type StepState } from "@/lib/setup-guide";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FLOW = [
  { icon: Users, label: "Lead", detail: "A call, text or web form lands in Leads.", to: "/app/leads" },
  { icon: FileText, label: "Estimate", detail: "Price it from your list, send a link, get approval.", to: "/app/estimates" },
  { icon: FolderOpen, label: "Job", detail: "Convert to a job folder and put it on the calendar.", to: "/app/jobs" },
  { icon: Clock, label: "Time & costs", detail: "Crew clock in; materials and hours roll into costing.", to: "/app/time" },
  { icon: Receipt, label: "Invoice", detail: "Bill from the job, send, and record payment.", to: "/app/invoices" },
];

const ROUTINES = [
  {
    icon: Sun, title: "Every morning (5 minutes)",
    items: [
      ["Open Overview and work the Needs your attention list top to bottom.", "/app"],
      ["Reply to new leads the same day; speed wins jobs.", "/app/leads"],
      ["Check Calendar so every crew knows where they're going.", "/app/calendar"],
    ],
  },
  {
    icon: HardHat, title: "On the job site",
    items: [
      ["Crew clock in and out from the field app. Location is saved when GPS allows.", "/app/time"],
      ["Keep notes, photos and paperwork in the job folder so everyone works from the same page.", "/app/jobs"],
      ["Change in scope? Add it to the estimate before the work, not after.", "/app/estimates"],
    ],
  },
  {
    icon: CalendarCheck, title: "Every week (20 minutes)",
    items: [
      ["Approve crew hours in Approvals before payroll.", "/app/approvals"],
      ["Follow up on estimates still waiting on a reply.", "/app/estimates"],
      ["Invoice finished work and chase anything overdue.", "/app/invoices"],
    ],
  },
  {
    icon: CalendarDays, title: "Every month",
    items: [
      ["Open Job costing and compare estimate vs. actual on closed jobs.", "/app/costing"],
      ["Update material prices that moved, so the next bid is right.", "/app/materials"],
      ["Review your plan and seats in Billing & plan.", "/app/billing"],
    ],
  },
] as const;

const TIPS = [
  { q: "Fastest way to write an estimate?", a: "Build your price list once, then pick lines. Photo estimate can draft one from job-site photos for you to check." },
  { q: "What does my crew see?", a: "Workers get the field app: their jobs and clock in and out. They can't open the office side, so estimates, invoices and settings stay with you." },
  { q: "Can Ask AI do work for me?", a: "Yes. Ask it about your business (\"which invoices are overdue?\") or have it draft a lead, estimate or job. It always asks before saving." },
  { q: "Where do customers approve and pay?", a: "From the link in your email or text. They approve on their phone, and pay a deposit by card if you've connected Stripe." },
];

function StepRow({ step, onToggle }: { step: StepState; onToggle: () => void }) {
  return (
    <Card className={`p-4 sm:p-5 ${step.complete ? "bg-secondary/30" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={step.auto}
          aria-label={step.complete ? `Mark "${step.title}" not done` : `Mark "${step.title}" done`}
          title={step.auto ? "Done (detected from your data)" : step.complete ? "Mark not done" : "Mark done"}
          className="mt-0.5 shrink-0 text-primary disabled:cursor-default"
        >
          {step.complete ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-semibold ${step.complete ? "text-muted-foreground line-through" : ""}`}>{step.title}</h3>
            {step.optional && <Badge variant="outline">Optional</Badge>}
            <span className="text-xs text-muted-foreground">~{step.minutes} min</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{step.why}</p>
          {!step.complete && (
            <>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {step.how.map((line) => <li key={line}>{line}</li>)}
              </ol>
              <Button asChild size="sm" className="mt-3">
                <Link to={step.to}>{step.cta} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function GettingStarted() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id;
  const facts = useSetupFacts(orgId);
  const [manual, setManual] = useState<Set<string>>(() => (orgId ? loadManual(orgId) : new Set()));
  const progress = useMemo(() => computeProgress(facts, manual), [facts, manual]);

  const toggle = (id: string) => {
    if (!orgId) return;
    const next = new Set(manual);
    if (next.has(id)) next.delete(id); else next.add(id);
    setManual(next);
    saveManual(orgId, next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Getting started with FastTract"
        description="Set up your business in about 35 minutes, then learn the routine that keeps it running."
        actions={progress.next ? (
          <Button asChild><Link to={progress.next.to}>Next: {progress.next.title} <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        ) : undefined}
      />

      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">1. Set up</TabsTrigger>
          <TabsTrigger value="run">2. Run your business</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">
                {progress.allRequiredDone ? "Setup complete. Nice work." : `${progress.doneRequired} of ${progress.totalRequired} setup steps done`}
              </span>
              <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
            </div>
            <Progress value={progress.percent} className="mt-3" />
            <p className="mt-3 text-xs text-muted-foreground">
              Steps check themselves off as you use FastTract. Already handled something another way? Click its circle to mark it done.
            </p>
          </Card>
          {progress.steps.map((step) => <StepRow key={step.id} step={step} onToggle={() => toggle(step.id)} />)}
        </TabsContent>

        <TabsContent value="run" className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold">How work moves through FastTract</h2>
            <p className="mt-1 text-sm text-muted-foreground">Every job follows the same path. Keep each one moving and nothing falls through the cracks.</p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-5">
              {FLOW.map((s, i) => (
                <li key={s.label}>
                  <Link to={s.to} className="block h-full rounded-lg border border-border p-3 transition hover:border-primary/50">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs text-primary">{i + 1}</span>
                      <s.icon className="h-4 w-4 text-primary" /> {s.label}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{s.detail}</p>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {ROUTINES.map((r) => (
              <Card key={r.title} className="p-5">
                <h3 className="flex items-center gap-2 font-semibold"><r.icon className="h-4 w-4 text-primary" /> {r.title}</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {r.items.map(([text, to]) => (
                    <li key={text}>
                      <Link to={to} className="flex gap-2 rounded-md p-1 hover:bg-secondary/40">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span>{text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Good to know</h2>
            <dl className="mt-3 grid gap-4 md:grid-cols-2">
              {TIPS.map((t) => (
                <div key={t.q}>
                  <dt className="text-sm font-medium">{t.q}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{t.a}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
