import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHighLevel } from "@/contexts/HighLevelContext";
import { highLevel } from "@/integrations/highlevel/client";
import { type AvaPlan, type AvaRiskLevel } from "@/lib/highlevelAva";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  approvalPayload,
  approvalRiskLabel,
  approvalStatusLabel,
  canApprove,
  isDuplicateApproval,
  sortApprovals,
  statusUpdatePayload,
  type AvaApprovalAction,
  type AvaApprovalStatus,
} from "./avaApprovalModel";

const AVA_ACTION_OBJECT = "ava_actions" as const;

function formatDate(value: string) {
  if (!value) return "No date";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function riskClass(risk: AvaRiskLevel) {
  if (risk === "financial") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (risk === "customer_communication") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  if (risk === "record_change") return "border-primary/30 bg-primary/10 text-primary";
  return "border-border bg-background/60 text-muted-foreground";
}

function statusClass(status: AvaApprovalStatus) {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "completed") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "dismissed") return "border-border bg-background/60 text-muted-foreground";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

function setupError(message: string) {
  return /ava action|ava_actions|custom object|schema|invalid object|not found/i.test(message);
}

export function AvaApprovalCenter({ plan }: { plan: AvaPlan | null }) {
  const { connection } = useHighLevel();
  const navigate = useNavigate();
  const [actions, setActions] = useState<AvaApprovalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await highLevel.listRecords(AVA_ACTION_OBJECT, { limit: 100 });
      setActions(sortApprovals(result.records ?? []));
      setSetupRequired(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load Ava approvals";
      setActions([]);
      setLoadError(message);
      setSetupRequired(setupError(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [connection?.locationId, load]);

  const duplicate = Boolean(plan && isDuplicateApproval(actions, plan));
  const pending = useMemo(
    () => actions.filter((action) => action.status === "draft" || action.status === "approved"),
    [actions],
  );
  const visible = showHistory ? actions : pending;

  const initialize = async () => {
    setSettingUp(true);
    try {
      const result = await highLevel.bootstrap();
      if (!result.ok && result.errors?.length) throw new Error(result.errors.join(" "));
      toast.success("Ava Approval Center is ready in this HighLevel sub-account");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to initialize Ava approvals");
    } finally {
      setSettingUp(false);
    }
  };

  const savePlan = async () => {
    if (!plan || !plan.requiresApproval) return;
    if (duplicate) {
      toast.info("This proposal is already waiting in the approval center");
      return;
    }

    setSavingPlan(true);
    try {
      await highLevel.createRecord(AVA_ACTION_OBJECT, approvalPayload(plan));
      toast.success("Ava proposal added to the approval center", {
        description: plan.missingInformation.length
          ? "Resolve the missing details before approving it."
          : "It is ready for human approval.",
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the Ava proposal");
    } finally {
      setSavingPlan(false);
    }
  };

  const transition = async (action: AvaApprovalAction, status: AvaApprovalStatus) => {
    setWorkingId(action.id);
    try {
      const payload = statusUpdatePayload(action, status);
      await highLevel.updateRecord(AVA_ACTION_OBJECT, action.id, payload);
      await load();
      if (status === "approved") {
        toast.success("Approved for final review", {
          description: "FastTract is opening the real workspace. The final save or send still requires your action.",
        });
        navigate(action.route);
      } else if (status === "completed") {
        toast.success("Ava action marked handled");
      } else if (status === "dismissed") {
        toast.success("Ava action dismissed");
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the Ava approval");
      return false;
    } finally {
      setWorkingId(null);
    }
  };

  const approve = async (action: AvaApprovalAction) => {
    if (!canApprove(action)) {
      toast.error("Resolve the missing information before approving this action");
      return;
    }
    const confirmed = window.confirm(
      `Approve "${action.actionTitle}" and open the final review screen?\n\n`
      + "This does not save, send, delete, charge, or record money by itself.",
    );
    if (!confirmed) return;
    await transition(action, "approved");
  };

  const revise = async (action: AvaApprovalAction) => {
    const confirmed = window.confirm(
      `Dismiss "${action.actionTitle}" and open the request in Ava for revision?\n\n`
      + "The original proposal will remain in history.",
    );
    if (!confirmed) return;
    const changed = await transition(action, "dismissed");
    if (changed) navigate(`/highlevel/ai?prompt=${encodeURIComponent(action.sourcePrompt)}&revise=${encodeURIComponent(action.id)}`);
  };

  const markHandled = async (action: AvaApprovalAction) => {
    if (!window.confirm(`Mark "${action.actionTitle}" as handled?`)) return;
    await transition(action, "completed");
  };

  const dismiss = async (action: AvaApprovalAction) => {
    if (!window.confirm(`Dismiss "${action.actionTitle}"? The proposal will remain in history.`)) return;
    await transition(action, "dismissed");
  };

  return (
    <section id="ava-approval-center" className="mx-auto mt-7 max-w-4xl overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-card">
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Human control</p>
              <h2 className="mt-1 text-xl font-semibold">Ava Approval Center</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Ava can prepare and organize work, but only an approved proposal may move into a final business workflow.
                Saving a proposal here never sends a message or changes a customer balance.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowHistory((value) => !value)}>
              {showHistory ? "Pending only" : "Show history"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <QueueMetric label="Waiting" value={actions.filter((action) => action.status === "draft").length} />
          <QueueMetric label="Approved" value={actions.filter((action) => action.status === "approved").length} />
          <QueueMetric label="Handled" value={actions.filter((action) => action.status === "completed").length} />
        </div>
      </div>

      {plan?.requiresApproval && (
        <div className="border-b border-border bg-primary/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              Current proposal
            </span>
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", riskClass(plan.riskLevel))}>
              {approvalRiskLabel(plan.riskLevel)}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold">{plan.actionTitle}</h3>
          {plan.targetLabel && <p className="mt-1 text-sm text-muted-foreground">Target: {plan.targetLabel}</p>}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.approvalReason}</p>

          <ProposalDetails changes={plan.proposedChanges} />

          {plan.missingInformation.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
                <CircleAlert className="h-4 w-4" /> Approval blocked
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {plan.missingInformation.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={() => void savePlan()} disabled={savingPlan || duplicate}>
              {savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {duplicate ? "Already waiting" : savingPlan ? "Saving proposal…" : "Save for approval"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Saved inside this signed HighLevel sub-account only.
            </p>
          </div>
        </div>
      )}

      {setupRequired ? (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
            <Sparkles className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">Initialize Ava approvals</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              FastTract will create the location-owned Ava Actions object and its review fields. Existing jobs, customers,
              estimates, and invoices are not changed.
            </p>
            {loadError && <p className="mt-3 text-xs text-muted-foreground">{loadError}</p>}
            <Button className="mt-4" onClick={() => void initialize()} disabled={settingUp}>
              {settingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {settingUp ? "Setting up…" : "Set up Approval Center"}
            </Button>
          </div>
        </div>
      ) : loadError ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p>{loadError}</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-3 p-5 sm:p-6">
          {[0, 1].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-muted/30" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-primary" />
          <h3 className="mt-4 font-semibold">{showHistory ? "No Ava actions have been saved" : "Nothing is waiting for approval"}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Ask Ava to prepare a lead, estimate, job, change order, invoice action, payment, or customer message.
            The proposal can be reviewed here before anything changes.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {visible.map((action) => (
            <article key={action.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  action.status === "approved" ? "bg-emerald-400/10 text-emerald-300" : "bg-primary/10 text-primary",
                )}>
                  {action.status === "approved" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusClass(action.status))}>
                      {approvalStatusLabel(action.status)}
                    </span>
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", riskClass(action.riskLevel))}>
                      {approvalRiskLabel(action.riskLevel)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{action.actionTitle}</h3>
                  {action.targetLabel && <p className="mt-1 text-sm text-muted-foreground">Target: {action.targetLabel}</p>}
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{action.summary || action.sourcePrompt}</p>

                  <ProposalDetails changes={action.proposedChanges} compact />

                  {action.draftContent && (
                    <div className="mt-4 rounded-xl border border-border bg-background/50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Customer-facing draft</p>
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6">{action.draftContent}</p>
                    </div>
                  )}

                  {action.missingInformation.length > 0 && (
                    <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
                      <p className="text-xs font-semibold text-warning">Needs information before approval</p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {action.missingInformation.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                    <p>Requested by {action.requestedBy || "HighLevel user"} · {formatDate(action.requestedDate || action.createdAt)}</p>
                    {action.approvedDate && <p>Approved by {action.approvedBy || "HighLevel user"} · {formatDate(action.approvedDate)}</p>}
                    {action.completedDate && <p>Handled by {action.completedBy || "HighLevel user"} · {formatDate(action.completedDate)}</p>}
                    {action.dismissedDate && <p>Dismissed by {action.dismissedBy || "HighLevel user"} · {formatDate(action.dismissedDate)}</p>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {action.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => void approve(action)}
                          disabled={workingId === action.id || !canApprove(action)}
                        >
                          {workingId === action.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Approve & review
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void revise(action)} disabled={workingId === action.id}>
                          Dismiss & revise
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void dismiss(action)} disabled={workingId === action.id}>
                          <XCircle className="h-4 w-4" /> Dismiss
                        </Button>
                      </>
                    )}
                    {action.status === "approved" && (
                      <>
                        <Button size="sm" onClick={() => navigate(action.route)}>
                          Open final review <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void markHandled(action)} disabled={workingId === action.id}>
                          {workingId === action.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Mark handled
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void dismiss(action)} disabled={workingId === action.id}>
                          <XCircle className="h-4 w-4" /> Dismiss
                        </Button>
                      </>
                    )}
                    {(action.status === "completed" || action.status === "dismissed") && (
                      <Button size="sm" variant="outline" onClick={() => navigate(action.route)}>
                        Open related workspace <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProposalDetails({
  changes,
  compact = false,
}: {
  changes: Array<{ label: string; value: string }>;
  compact?: boolean;
}) {
  if (changes.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
        Ava did not fill any final business values. The destination workspace will require the contractor to enter and verify them.
      </p>
    );
  }

  const shown = compact ? changes.slice(0, 4) : changes;
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {shown.map((change, index) => (
        <div key={`${change.label}:${index}`} className="min-w-0 rounded-lg border border-border bg-background/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{change.label}</p>
          <p className="mt-1 break-words text-sm">{change.value}</p>
        </div>
      ))}
      {compact && changes.length > shown.length && (
        <p className="text-xs text-muted-foreground">+{changes.length - shown.length} more proposed detail{changes.length - shown.length === 1 ? "" : "s"}</p>
      )}
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
