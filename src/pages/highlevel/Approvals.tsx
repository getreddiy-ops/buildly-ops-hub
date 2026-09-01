import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Clock3,
  FileCheck2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHighLevel } from "@/contexts/HighLevelContext";
import { highLevel, type HighLevelRecord } from "@/integrations/highlevel/client";
import {
  approvalIntent,
  approvalMissingInformation,
  approvalName,
  approvalPropertyKeys,
  approvalRisk,
  approvalRiskLabel,
  approvalStatus,
  approvalStatusLabel,
  readApprovalString,
  safeApprovalRoute,
  sortApprovals,
  summarizeApprovals,
  type FastTractApprovalRisk,
  type FastTractApprovalStatus,
} from "@/lib/highlevelApprovals";
import { avaIntentLabel } from "@/lib/highlevelAva";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ApprovalFilter = FastTractApprovalStatus | "open" | "all";

const riskIcons: Record<FastTractApprovalRisk, LucideIcon> = {
  review: FileCheck2,
  record_change: ShieldCheck,
  communication: MessageSquareText,
  financial: WalletCards,
};

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "Not reviewed yet";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusClass(status: FastTractApprovalStatus) {
  if (status === "pending") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (status === "in_review") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  if (status === "completed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function riskClass(risk: FastTractApprovalRisk) {
  if (risk === "financial") return "border-primary/35 bg-primary/10 text-primary";
  if (risk === "communication") return "border-violet-400/30 bg-violet-400/10 text-violet-300";
  if (risk === "record_change") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  return "border-border bg-background/50 text-muted-foreground";
}

export default function HighLevelApprovals() {
  const navigate = useNavigate();
  const { connection } = useHighLevel();
  const [rows, setRows] = useState<HighLevelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ApprovalFilter>("open");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<HighLevelRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await highLevel.listRecords("approval_actions", { limit: 100 });
      setRows(sortApprovals(result.records ?? []));
      setSetupRequired(false);
    } catch (error) {
      setRows([]);
      setSetupRequired(true);
      toast.error(error instanceof Error ? error.message : "Unable to load Ava approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [connection?.locationId, load]);

  const summary = useMemo(() => summarizeApprovals(rows), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const status = approvalStatus(row);
      const statusMatches = filter === "all"
        || (filter === "open" ? status === "pending" || status === "in_review" : status === filter);
      if (!statusMatches) return false;
      if (!needle) return true;
      return [
        approvalName(row),
        readApprovalString(row, approvalPropertyKeys.summary),
        readApprovalString(row, approvalPropertyKeys.sourcePrompt),
        readApprovalString(row, approvalPropertyKeys.draftContent),
        approvalIntent(row),
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [filter, query, rows]);

  const summaryCounts = useMemo(() => summarizeApprovals(rows), [rows]);

  const initialize = async () => {
    setSettingUp(true);
    try {
      const result = await highLevel.bootstrap();
      if (!result.ok && result.errors?.length) throw new Error(result.errors.join(" "));
      toast.success("Ava’s approval center is ready in this HighLevel sub-account");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to initialize the approval center");
    } finally {
      setSettingUp(false);
    }
  };

  const updateStatus = async (
    record: HighLevelRecord,
    status: FastTractApprovalStatus,
    options: { navigateAfter?: boolean; closeAfter?: boolean } = {},
  ) => {
    setWorkingId(record.id);
    try {
      const result = await highLevel.updateRecord("approval_actions", record.id, {
        properties: {
          status,
          reviewed_date: ["in_review", "completed", "rejected"].includes(status) ? localDateValue() : null,
          completed_date: status === "completed" ? localDateValue() : null,
          notes: reviewNotes.trim() || null,
        },
      });
      setRows((current) => sortApprovals(current.map((item) => item.id === record.id ? result.record : item)));
      setSelected((current) => current?.id === record.id ? result.record : current);
      toast.success(
        status === "in_review"
          ? "Approval moved into review"
          : status === "completed"
            ? "Approval marked complete"
            : "Approval rejected and retained in the audit history",
      );

      if (options.closeAfter) setSelected(null);
      if (options.navigateAfter) {
        const route = safeApprovalRoute(readApprovalString(record, approvalPropertyKeys.route));
        navigate(route);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the approval");
    } finally {
      setWorkingId(null);
    }
  };

  const beginReview = async (record: HighLevelRecord) => {
    const status = approvalStatus(record);
    if (status === "pending") {
      await updateStatus(record, "in_review", { navigateAfter: true, closeAfter: true });
      return;
    }
    navigate(safeApprovalRoute(readApprovalString(record, approvalPropertyKeys.route)));
  };

  const complete = async (record: HighLevelRecord) => {
    if (!window.confirm("Mark this Ava action complete? Use this only after the reviewed action was actually saved or sent in its FastTract workspace.")) return;
    await updateStatus(record, "completed", { closeAfter: true });
  };

  const reject = async (record: HighLevelRecord) => {
    if (!window.confirm("Reject this prepared action? The record will stay in the approval history and no business action will be performed.")) return;
    await updateStatus(record, "rejected", { closeAfter: true });
  };

  const copyDraft = async (record: HighLevelRecord) => {
    const draft = readApprovalString(record, approvalPropertyKeys.draftContent);
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Draft copied");
    } catch {
      toast.error("The browser could not copy the draft. Select the text and copy it manually.");
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Ava approvals"
        description="Review every AI-prepared record, message, and financial action before anything is saved or sent."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Button size="sm" onClick={() => navigate("/highlevel/ai")}>
              <Sparkles className="h-4 w-4" /> Ask Ava
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Waiting" value={summaryCounts.pending} icon={Clock3} active={filter === "pending"} onClick={() => setFilter("pending")} />
        <SummaryCard label="In review" value={summaryCounts.inReview} icon={ShieldCheck} active={filter === "in_review"} onClick={() => setFilter("in_review")} />
        <SummaryCard label="Financial" value={summaryCounts.financial} icon={WalletCards} active={false} onClick={() => setFilter("open")} />
        <SummaryCard label="Completed" value={summaryCounts.completed} icon={CheckCircle2} active={filter === "completed"} onClick={() => setFilter("completed")} />
      </div>

      <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">Ava never approves Ava</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              This queue records what Ava prepared and who reviewed it. The actual customer, job, estimate, invoice, payment, or message action still happens through its dedicated FastTract review screen.
            </p>
          </div>
        </div>
        <Button className="mt-4 shrink-0 sm:mt-0" variant="outline" onClick={() => setFilter("open")}>Review open actions</Button>
      </div>

      <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card/40 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0"
            placeholder="Search approvals, prompts, and drafts…"
          />
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as ApprovalFilter)}>
          <SelectTrigger className="h-11 w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open approvals</SelectItem>
            <SelectItem value="all">All approvals</SelectItem>
            <SelectItem value="pending">Waiting for review</SelectItem>
            <SelectItem value="in_review">In review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {setupRequired ? (
        <div className="rounded-2xl border border-primary/25 bg-card p-6 shadow-card sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <h2 className="mt-5 text-xl font-semibold">Initialize Ava’s approval center</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            FastTract will create a location-owned Approval Actions record type for this signed HighLevel sub-account. No customer data is changed during setup.
          </p>
          <Button className="mt-5" onClick={() => void initialize()} disabled={settingUp}>
            {settingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {settingUp ? "Setting up…" : "Set up approval center"}
          </Button>
        </div>
      ) : loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-border bg-card/40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-9 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Nothing is waiting in this view</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Ask Ava to prepare a lead, job, estimate, payment follow-up, or other business action, then add it to this approval center.
          </p>
          <Button className="mt-5" onClick={() => navigate("/highlevel/ai")}><Sparkles className="h-4 w-4" /> Ask Ava</Button>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {filtered.map((record) => {
            const status = approvalStatus(record);
            const risk = approvalRisk(record);
            const RiskIcon = riskIcons[risk];
            const missing = approvalMissingInformation(record);
            const summaryText = readApprovalString(record, approvalPropertyKeys.summary);
            const createdBy = readApprovalString(record, approvalPropertyKeys.createdByName);
            return (
              <article key={record.id} className="min-w-0 rounded-2xl border border-border bg-card/50 p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", riskClass(risk))}><RiskIcon className="h-5 w-5" /></div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", riskClass(risk))}>{approvalRiskLabel(risk)}</span>
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusClass(status))}>{approvalStatusLabel(status)}</span>
                  </div>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-primary">{avaIntentLabel(approvalIntent(record))}</p>
                <h2 className="mt-1 line-clamp-2 text-lg font-semibold">{approvalName(record)}</h2>
                {summaryText && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{summaryText}</p>}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {missing.length > 0 && <span>{missing.length} item{missing.length === 1 ? "" : "s"} need clarification</span>}
                  {createdBy && <span>Prepared for review by {createdBy}</span>}
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button size="sm" onClick={() => void beginReview(record)} disabled={workingId === record.id || status === "completed" || status === "rejected"}>
                    {workingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {status === "pending" ? "Begin review" : status === "in_review" ? "Continue review" : "Review closed"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setReviewNotes(readApprovalString(record, approvalPropertyKeys.notes)); setSelected(record); }}>Details</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(next) => { if (!next) setSelected(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4 pr-7">
                  <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", riskClass(approvalRisk(selected)))}>
                    {(() => {
                      const Icon = riskIcons[approvalRisk(selected)];
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", riskClass(approvalRisk(selected)))}>{approvalRiskLabel(approvalRisk(selected))}</span>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusClass(approvalStatus(selected)))}>{approvalStatusLabel(approvalStatus(selected))}</span>
                    </div>
                    <DialogTitle className="mt-3 text-xl">{approvalName(selected)}</DialogTitle>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <Detail label="What you asked" value={readApprovalString(selected, approvalPropertyKeys.sourcePrompt)} />
                <Detail label="What Ava understood" value={readApprovalString(selected, approvalPropertyKeys.summary)} />
                <Detail label="Required review step" value={readApprovalString(selected, approvalPropertyKeys.nextStep)} />

                {approvalMissingInformation(selected).length > 0 && (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Needs clarification</p>
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      {approvalMissingInformation(selected).map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {readApprovalString(selected, approvalPropertyKeys.draftContent) && (
                  <div className="rounded-xl border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Customer-facing draft</p>
                      <Button size="sm" variant="ghost" onClick={() => void copyDraft(selected)}><Clipboard className="h-4 w-4" /> Copy</Button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{readApprovalString(selected, approvalPropertyKeys.draftContent)}</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Prepared by" value={readApprovalString(selected, approvalPropertyKeys.createdByName) || "HighLevel user"} compact />
                  <Detail label="Reviewed by" value={readApprovalString(selected, approvalPropertyKeys.reviewedByName) || "Not reviewed yet"} compact />
                  <Detail label="Review date" value={formatDate(readApprovalString(selected, approvalPropertyKeys.reviewedDate))} compact />
                  <Detail label="Completed date" value={formatDate(readApprovalString(selected, approvalPropertyKeys.completedDate))} compact />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="approval-notes" className="text-xs font-medium text-muted-foreground">Reviewer notes</label>
                  <Textarea
                    id="approval-notes"
                    rows={3}
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Add why this was changed, completed, or rejected…"
                    disabled={approvalStatus(selected) === "completed" || approvalStatus(selected) === "rejected"}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {approvalStatus(selected) !== "completed" && approvalStatus(selected) !== "rejected" && (
                    <>
                      <Button variant="destructive" onClick={() => void reject(selected)} disabled={workingId === selected.id}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button variant="outline" onClick={() => void complete(selected)} disabled={workingId === selected.id}>
                        <CheckCircle2 className="h-4 w-4" /> Mark complete
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
                  {approvalStatus(selected) !== "completed" && approvalStatus(selected) !== "rejected" && (
                    <Button onClick={() => void beginReview(selected)} disabled={workingId === selected.id}>
                      {workingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {approvalStatus(selected) === "pending" ? "Begin review" : "Continue review"}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-secondary/50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </button>
  );
}

function Detail({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-background/50", compact ? "p-3" : "p-4")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 whitespace-pre-wrap text-sm", compact ? "leading-5" : "leading-7")}>{value || "Not supplied"}</p>
    </div>
  );
}
