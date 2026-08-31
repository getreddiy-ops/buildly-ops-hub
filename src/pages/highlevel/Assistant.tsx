import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  Loader2,
  Mic,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  avaIntentLabel,
  avaSuggestions,
  buildAvaBusinessSnapshot,
  normalizeAvaPlan,
  type AvaBusinessSnapshot,
  type AvaDraftResult,
  type AvaIntent,
  type AvaPlan,
} from "@/lib/highlevelAva";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const emptySnapshot: AvaBusinessSnapshot = {
  openLeads: 0,
  qualifiedLeads: 0,
  activeJobs: 0,
  draftEstimates: 0,
  waitingEstimates: 0,
  acceptedEstimateValue: 0,
  draftInvoiceValue: 0,
  outstandingInvoiceValue: 0,
  overdueInvoiceValue: 0,
  topPriority: null,
};

const intentValues: AvaIntent[] = [
  "create_estimate",
  "create_job",
  "create_lead",
  "create_customer",
  "review_leads",
  "review_jobs",
  "review_money",
  "find_customer",
  "add_time",
  "add_material",
  "update_job",
  "follow_up_invoice",
  "other",
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function HighLevelAssistant() {
  const { firstName, connection } = useHighLevel();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const incomingPrompt = searchParams.get("prompt") ?? "";
  const [prompt, setPrompt] = useState(incomingPrompt);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AvaPlan | null>(null);
  const [snapshot, setSnapshot] = useState<AvaBusinessSnapshot>(emptySnapshot);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotWarnings, setSnapshotWarnings] = useState<string[]>([]);
  const autoRunRef = useRef("");
  const voice = useBrowserSpeech((transcript) => {
    setPrompt((current) => [current.trim(), transcript].filter(Boolean).join(" "));
  });

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    const results = await Promise.allSettled([
      highLevel.listLeads({ limit: 100 }),
      highLevel.listEstimates({ limit: 100, status: "all" }),
      highLevel.listInvoices({ limit: 100, status: "all" }),
      highLevel.listRecords("jobs", { limit: 100 }),
    ]);

    const leads: FastTractLead[] = results[0].status === "fulfilled" ? results[0].value.leads ?? [] : [];
    const estimates: HighLevelEstimate[] = results[1].status === "fulfilled" ? results[1].value.estimates ?? [] : [];
    const invoices: HighLevelInvoice[] = results[2].status === "fulfilled" ? results[2].value.invoices ?? [] : [];
    const jobs: HighLevelRecord[] = results[3].status === "fulfilled" ? results[3].value.records ?? [] : [];
    const warnings: string[] = [];

    if (results[0].status === "rejected") warnings.push("Lead context is temporarily unavailable.");
    if (results[1].status === "rejected") warnings.push("Estimate context is temporarily unavailable.");
    if (results[2].status === "rejected") warnings.push("Invoice context is temporarily unavailable.");
    if (results[3].status === "rejected") warnings.push("Job context is temporarily unavailable.");

    setSnapshot(buildAvaBusinessSnapshot({ leads, estimates, invoices, jobs }));
    setSnapshotWarnings(warnings);
    setSnapshotLoading(false);
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [connection?.locationId, loadSnapshot]);

  useEffect(() => {
    if (incomingPrompt) setPrompt(incomingPrompt);
  }, [incomingPrompt]);

  const processPrompt = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value) return;

    setLoading(true);
    setPlan(null);
    try {
      const response = await highLevel.aiFormFill<AvaDraftResult>({
        prompt: value,
        formName: "FastTract Ava business request planner",
        fields: [
          {
            name: "intent",
            enum: intentValues,
            description: "The user's primary contractor-business intent",
          },
          { name: "summary", description: "A short plain-language restatement of what Ava understood. Never say the action is already complete." },
          { name: "next_step", description: "The exact review or workspace step the contractor should take next" },
          { name: "draft_content", description: "For customer follow-up or payment reminders, write the complete draft message. Otherwise return an empty string." },
          { name: "missing_information", type: "json", description: "An array of important missing details. Return an empty array when nothing critical is missing." },
          { name: "requires_approval", type: "boolean", description: "True when the request creates, changes, sends, deletes, or financially commits business data" },
        ],
        context: {
          locationId: connection?.locationId,
          businessSnapshot: snapshot,
          instruction: "Use plain contractor language. Treat the business snapshot as current aggregate context only. Never invent customer identities, measurements, dates, prices, tax rates, record IDs, or completed actions. For messages, draft only and explicitly wait for human approval before sending. FastTract chooses the final route deterministically after your response.",
        },
      });

      setPlan(normalizeAvaPlan(value, response.values));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ava could not process that request");
    } finally {
      setLoading(false);
    }
  }, [connection?.locationId, snapshot]);

  useEffect(() => {
    if (snapshotLoading || !incomingPrompt || autoRunRef.current === incomingPrompt) return;
    autoRunRef.current = incomingPrompt;
    void processPrompt(incomingPrompt);
  }, [incomingPrompt, processPrompt, snapshotLoading]);

  const suggestions = useMemo(() => avaSuggestions(snapshot), [snapshot]);

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    await processPrompt(prompt);
  };

  const changeRequest = () => {
    setPlan(null);
    autoRunRef.current = "";
    const next = new URLSearchParams(searchParams);
    next.delete("prompt");
    setSearchParams(next, { replace: true });
  };

  const copyDraft = async () => {
    if (!plan?.draftContent) return;
    try {
      await navigator.clipboard.writeText(plan.draftContent);
      toast.success("Draft copied");
    } catch {
      toast.error("The browser could not copy that draft. Select the text and copy it manually.");
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-4 py-7 sm:px-7 lg:px-9">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 shadow-elevated">
          <img
            src="/ava-onboarding.png"
            alt="Ava, the FastTract assistant"
            className="h-full w-full object-cover object-[center_24%]"
          />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ava · FastTract AI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What should we handle, {firstName}?</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Say it the way you would explain it to someone on your crew. Ava uses this sub-account’s live business pulse, prepares the work, and keeps you in control of every change.
        </p>
      </div>

      <div className="mx-auto mt-7 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
        <PulseCard icon={Users} label="Open leads" value={snapshotLoading ? "—" : String(snapshot.openLeads)} detail={`${snapshot.qualifiedLeads} qualified`} alert={snapshot.qualifiedLeads > 0} />
        <PulseCard icon={BriefcaseBusiness} label="Active jobs" value={snapshotLoading ? "—" : String(snapshot.activeJobs)} detail="Current and scheduled" />
        <PulseCard icon={Receipt} label="Ready to invoice" value={snapshotLoading ? "—" : money.format(snapshot.acceptedEstimateValue)} detail={`${snapshot.draftEstimates} estimate drafts`} alert={snapshot.acceptedEstimateValue > 0} />
        <PulseCard icon={WalletCards} label="Overdue" value={snapshotLoading ? "—" : money.format(snapshot.overdueInvoiceValue)} detail={snapshot.overdueInvoiceValue > 0 ? "Needs follow-up" : "Nothing overdue"} alert={snapshot.overdueInvoiceValue > 0} />
      </div>

      {snapshot.topPriority && !snapshotLoading && (
        <div className="mx-auto mt-4 flex max-w-4xl items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div><span className="font-semibold">Ava’s first look:</span> <span className="text-muted-foreground">{snapshot.topPriority}</span></div>
        </div>
      )}

      {snapshotWarnings.length > 0 && (
        <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-muted-foreground">
          {snapshotWarnings.join(" ")} Ava will still plan from the information that loaded successfully.
        </div>
      )}

      <form onSubmit={(event) => void run(event)} className="mx-auto mt-7 max-w-4xl rounded-2xl border border-primary/25 bg-card p-3 shadow-elevated">
        <Textarea
          rows={7}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Build a customer-facing estimate for a 30 x 20 stamped patio. Remove the existing slab, add four inches of compacted rock, use rebar, include two steps and a concrete pump."
          className="resize-none border-0 bg-transparent text-base leading-7 shadow-none focus-visible:ring-0"
          autoFocus={!incomingPrompt}
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4 text-primary" /> Ava prepares work. You approve business changes before they are saved or sent.</p>
          <div className="ml-auto flex gap-2">
            <Button type="button" size="icon" variant="ghost" aria-label={voice.listening ? "Stop voice input" : "Speak to Ava"} onClick={voice.listening ? voice.stop : voice.start}><Mic className={voice.listening ? "h-5 w-5 animate-pulse text-primary" : "h-5 w-5"} /></Button>
            <Button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? "Planning…" : "Plan the work"}
            </Button>
          </div>
        </div>
      </form>

      {!plan && !loading && (
        <div className="mx-auto mt-6 grid max-w-4xl gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setPrompt(suggestion)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4 text-left text-sm transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="mx-auto mt-6 flex max-w-4xl items-center gap-4 rounded-2xl border border-primary/25 bg-card p-5 shadow-card">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Loader2 className="h-5 w-5 animate-spin" /></div>
          <div><p className="font-semibold">Ava is organizing the request</p><p className="mt-1 text-sm text-muted-foreground">Checking the right workspace, approval level, and any important missing details.</p></div>
        </div>
      )}

      {plan && (
        <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-primary/25 bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{avaIntentLabel(plan.intent)}</span>
                <span className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground">Prepared—not completed</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{plan.summary}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.nextStep}</p>

              {plan.missingInformation.length > 0 && (
                <div className="mt-5 rounded-xl border border-warning/25 bg-warning/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-warning">Needs clarification</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {plan.missingInformation.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              )}

              {plan.draftContent && (
                <div className="mt-5 rounded-xl border border-border bg-background/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Draft for review</p>
                    <Button size="sm" variant="ghost" onClick={() => void copyDraft()}><Clipboard className="h-4 w-4" /> Copy</Button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{plan.draftContent}</p>
                </div>
              )}

              {plan.requiresApproval && (
                <p className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  This request can affect business records or customer communication. FastTract will keep it as a draft until you review and approve the final action.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => navigate(plan.route)}>
                  {plan.actionLabel} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={changeRequest}>Change request</Button>
                <Button variant="ghost" onClick={() => void loadSnapshot()} disabled={snapshotLoading}>
                  {snapshotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Refresh business pulse
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PulseCard({
  icon: Icon,
  label,
  value,
  detail,
  alert = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      "min-w-0 rounded-xl border p-4 text-left shadow-card",
      alert ? "border-primary/35 bg-primary/10" : "border-border bg-card/40",
    )}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4 shrink-0", alert ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="mt-2 truncate text-lg font-semibold sm:text-xl">{value}</p>
      <p className={cn("mt-1 truncate text-[11px]", alert ? "text-primary" : "text-muted-foreground")}>{detail}</p>
    </div>
  );
}
