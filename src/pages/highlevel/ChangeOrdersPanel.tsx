import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FileClock,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Send,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { AiFormHelper } from "@/components/AiFormHelper";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  highLevel,
  type HighLevelEstimate,
  type HighLevelRecord,
} from "@/integrations/highlevel/client";
import {
  approvalEstimateForChangeOrder,
  approvalEstimatePayload,
  changeOrderFormFromRecord,
  changeOrderName,
  changeOrderPropertyKeys,
  changeOrderRecordPayload,
  changeOrderStatus,
  changeOrderStatusLabel,
  changeOrderTotal,
  linkedJobForChangeOrder,
  sortChangeOrders,
  summarizeChangeOrders,
  type ChangeOrderForm,
  type FastTractChangeOrderStatus,
} from "@/lib/highlevelChangeOrders";
import {
  jobName,
  jobPropertyKeys,
  jobStatus,
  readRecordString,
} from "@/lib/highlevelJobWorkspace";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const emptyChangeOrder = (): ChangeOrderForm => ({
  change_order_name: "",
  job_id: "",
  amount: 0,
  tax_percent: 0,
  requested_date: localDateValue(),
  description: "",
  notes: "",
});

const changeOrderSchema = z.object({
  change_order_name: z.string().trim().min(1, "Change order name is required").max(180),
  job_id: z.string().trim().min(1, "Select the job this change belongs to"),
  amount: z.coerce.number().positive("Change order amount must be greater than zero"),
  tax_percent: z.coerce.number().min(0, "Tax cannot be negative").max(100, "Tax cannot exceed 100%"),
  requested_date: z.string().trim().min(1, "Requested date is required"),
  description: z.string().trim().min(1, "Describe the scope change").max(5000),
  notes: z.string().trim().max(3000),
});

type ChangeOrderAiValues = Omit<ChangeOrderForm, "job_id"> & { job_name?: string };

function nestedId(value: unknown, keys: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  for (const key of ["estimate", "invoice", "data", "result"]) {
    const found = nestedId(record[key], keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function statusClass(status: FastTractChangeOrderStatus) {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-400";
  if (status === "sent") return "border-sky-400/30 bg-sky-400/10 text-sky-400";
  if (status === "declined") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "invoiced") return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-400/30 bg-amber-400/10 text-amber-400";
}

function formatDate(value: string) {
  if (!value) return "No date";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ChangeOrdersPanel({
  jobs,
  estimates,
  changeOrders,
  loading,
  setupRequired,
  onChanged,
}: {
  jobs: HighLevelRecord[];
  estimates: HighLevelEstimate[];
  changeOrders: HighLevelRecord[];
  loading: boolean;
  setupRequired: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HighLevelRecord | null>(null);
  const [form, setForm] = useState<ChangeOrderForm>(emptyChangeOrder());
  const [saving, setSaving] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const availableJobs = useMemo(() => jobs
    .filter((job) => jobStatus(job) !== "complete")
    .sort((a, b) => jobName(a).localeCompare(jobName(b))), [jobs]);
  const ordered = useMemo(() => sortChangeOrders(changeOrders, estimates), [changeOrders, estimates]);
  const summary = useMemo(() => summarizeChangeOrders(changeOrders, estimates), [changeOrders, estimates]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyChangeOrder());
    setFormOpen(true);
  };

  const openEdit = (record: HighLevelRecord) => {
    const approval = approvalEstimateForChangeOrder(record, estimates);
    const status = changeOrderStatus(record, approval);
    if (status === "sent" || status === "approved" || status === "invoiced") {
      toast.info("This change order is locked", {
        description: "Open the approval estimate or invoice instead of changing the agreed scope.",
      });
      return;
    }
    setEditing(record);
    setForm(changeOrderFormFromRecord(record));
    setFormOpen(true);
  };

  const applyAiValues = (values: Partial<ChangeOrderAiValues>) => {
    setForm((current) => {
      let jobId = current.job_id;
      if (values.job_name) {
        const target = String(values.job_name).trim().toLowerCase();
        const match = availableJobs.find((job) => jobName(job).toLowerCase() === target);
        if (match) jobId = match.id;
      }
      return {
        ...current,
        ...values,
        job_id: jobId,
        amount: values.amount === undefined ? current.amount : Math.max(0, Number(values.amount) || 0),
        tax_percent: values.tax_percent === undefined
          ? current.tax_percent
          : Math.min(100, Math.max(0, Number(values.tax_percent) || 0)),
      };
    });
  };

  const initialize = async () => {
    setSettingUp(true);
    try {
      const result = await highLevel.bootstrap();
      if (!result.ok && result.errors?.length) throw new Error(result.errors.join(" "));
      toast.success("FastTract Change Orders is ready");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to initialize change orders");
    } finally {
      setSettingUp(false);
    }
  };

  const save = async () => {
    const parsed = changeOrderSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const job = jobs.find((row) => row.id === parsed.data.job_id);
    if (!job) {
      toast.error("The selected job is not available in this HighLevel sub-account");
      return;
    }
    if (!readRecordString(job, jobPropertyKeys.customerId)) {
      toast.error("Link a customer to the job before creating a change order");
      return;
    }

    setSaving(true);
    try {
      const payload = changeOrderRecordPayload(parsed.data, job, editing);
      const existingStatus = editing
        ? changeOrderStatus(editing, approvalEstimateForChangeOrder(editing, estimates))
        : "draft";
      if (editing && existingStatus === "declined") {
        payload.properties.approval_estimate_id = null;
        payload.properties.invoice_id = null;
        payload.properties.approved_date = null;
        payload.properties.status = "draft";
      }

      if (editing) {
        await highLevel.updateRecord("change_orders", editing.id, payload);
        toast.success("Change order updated");
      } else {
        await highLevel.createRecord("change_orders", payload);
        toast.success("Change order draft created");
      }
      setFormOpen(false);
      setEditing(null);
      setForm(emptyChangeOrder());
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the change order");
    } finally {
      setSaving(false);
    }
  };

  const prepareApproval = async (record: HighLevelRecord) => {
    const job = linkedJobForChangeOrder(record, jobs);
    if (!job) {
      toast.error("The linked job could not be found");
      return;
    }
    if (approvalEstimateForChangeOrder(record, estimates)) {
      toast.info("An approval estimate already exists for this change order");
      return;
    }

    setWorkingId(`prepare:${record.id}`);
    try {
      const result = await highLevel.createEstimate(approvalEstimatePayload(record, job));
      const approvalEstimateId = nestedId(result, ["_id", "id"]);
      if (!approvalEstimateId) throw new Error("HighLevel did not return the approval estimate id");

      const payload = changeOrderRecordPayload(changeOrderFormFromRecord(record), job, record);
      payload.properties.approval_estimate_id = approvalEstimateId;
      payload.properties.status = "draft";
      await highLevel.updateRecord("change_orders", record.id, payload);
      toast.success("Customer approval estimate created", {
        description: "Review the scope and price before sending it.",
      });
      await onChanged();
      navigate(`/highlevel/estimates?edit=${encodeURIComponent(approvalEstimateId)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to prepare customer approval");
    } finally {
      setWorkingId(null);
    }
  };

  const sendApproval = async (record: HighLevelRecord, approval: HighLevelEstimate) => {
    if (!window.confirm(`Send “${approval.name}” to the customer for approval now?`)) return;
    setWorkingId(`send:${record.id}`);
    try {
      await highLevel.sendEstimate(approval._id, { channel: "sms_and_email", name: approval.name });
      const job = linkedJobForChangeOrder(record, jobs);
      if (job) {
        const payload = changeOrderRecordPayload(changeOrderFormFromRecord(record), job, record);
        payload.properties.status = "sent";
        await highLevel.updateRecord("change_orders", record.id, payload);
      }
      toast.success("Change order sent for customer approval");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the change order");
    } finally {
      setWorkingId(null);
    }
  };

  const createInvoice = async (record: HighLevelRecord, approval: HighLevelEstimate) => {
    if (approval.status !== "accepted") {
      toast.error("The customer must accept the change order before it can be invoiced");
      return;
    }
    if (!window.confirm(`Create a native HighLevel invoice for “${changeOrderName(record)}”?`)) return;

    setWorkingId(`invoice:${record.id}`);
    try {
      const result = await highLevel.convertEstimateToInvoice(approval._id);
      const invoiceId = nestedId(result, ["_id", "id"]);
      if (!invoiceId) throw new Error("HighLevel did not return the invoice id");
      const job = linkedJobForChangeOrder(record, jobs);
      if (!job) throw new Error("The linked job could not be found");

      const payload = changeOrderRecordPayload(changeOrderFormFromRecord(record), job, record);
      payload.properties.invoice_id = invoiceId;
      payload.properties.status = "invoiced";
      payload.properties.approved_date = localDateValue();
      await highLevel.updateRecord("change_orders", record.id, payload);
      toast.success("Change order invoice created in HighLevel");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invoice the change order");
    } finally {
      setWorkingId(null);
    }
  };

  const removeDraft = async (record: HighLevelRecord) => {
    if (approvalEstimateForChangeOrder(record, estimates)) {
      toast.error("Delete or resolve the linked approval estimate before removing this draft");
      return;
    }
    if (!window.confirm(`Delete the draft change order “${changeOrderName(record)}”?`)) return;
    setWorkingId(`delete:${record.id}`);
    try {
      await highLevel.deleteRecord("change_orders", record.id);
      toast.success("Change order draft deleted");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the change order");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="mt-7 overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Change orders</h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Keep added work outside the original scope until the customer approves a native HighLevel estimate.
          </p>
        </div>
        <Button size="sm" onClick={openNew} disabled={setupRequired || availableJobs.length === 0}>
          <Plus className="h-4 w-4" /> New change order
        </Button>
      </div>

      {!loading && !setupRequired && (
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
          <ChangeSummary label="Draft" value={summary.draftValue} count={summary.draftCount} />
          <ChangeSummary label="Awaiting approval" value={summary.awaitingValue} count={summary.awaitingCount} />
          <ChangeSummary label="Approved" value={summary.approvedValue} count={summary.approvedCount} />
          <ChangeSummary label="Invoiced" value={summary.invoicedValue} count={summary.invoicedCount} />
        </div>
      )}

      {setupRequired ? (
        <div className="p-6 sm:p-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Wrench className="h-5 w-5" /></div>
          <h3 className="mt-4 font-semibold">Set up FastTract Change Orders</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            FastTract will add the location-isolated Change Order record and fields to this HighLevel sub-account.
          </p>
          <Button className="mt-5" size="sm" onClick={() => void initialize()} disabled={settingUp}>
            {settingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {settingUp ? "Setting up…" : "Set up change orders"}
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3 p-5">{[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-muted/30" />)}</div>
      ) : availableJobs.length === 0 ? (
        <div className="p-7 text-center">
          <CircleAlert className="mx-auto h-8 w-8 text-amber-400" />
          <h3 className="mt-3 font-semibold">Create and link a job first</h3>
          <p className="mt-2 text-sm text-muted-foreground">A change order must belong to a customer-linked FastTract job.</p>
          <Button className="mt-4" size="sm" variant="outline" asChild><Link to="/highlevel/jobs">Open Jobs</Link></Button>
        </div>
      ) : ordered.length === 0 ? (
        <div className="p-7 text-center">
          <FileCheck2 className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 font-semibold">No scope changes yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create a change order when the customer adds, removes, or revises work.</p>
          <Button className="mt-4" size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New change order</Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {ordered.map((record) => {
            const approval = approvalEstimateForChangeOrder(record, estimates);
            const status = changeOrderStatus(record, approval);
            const job = linkedJobForChangeOrder(record, jobs);
            const approvalId = readRecordString(record, changeOrderPropertyKeys.approvalEstimateId);
            const invoiceId = readRecordString(record, changeOrderPropertyKeys.invoiceId);
            const busy = Boolean(workingId?.endsWith(`:${record.id}`));
            return (
              <article key={record.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    {status === "approved" || status === "invoiced" ? <FileCheck2 className="h-5 w-5" /> : <FileClock className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{changeOrderName(record)}</h3>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusClass(status))}>
                        {changeOrderStatusLabel(status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job ? jobName(job) : "Linked job unavailable"}
                      {readRecordString(record, changeOrderPropertyKeys.requestedDate)
                        ? ` · Requested ${formatDate(readRecordString(record, changeOrderPropertyKeys.requestedDate))}`
                        : ""}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {readRecordString(record, changeOrderPropertyKeys.description) || "No customer-facing scope has been added."}
                    </p>
                  </div>
                  <div className="shrink-0 lg:min-w-36 lg:text-right">
                    <p className="text-xs text-muted-foreground">Change total</p>
                    <p className="mt-1 text-xl font-semibold">{money.format(changeOrderTotal(record))}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                  {(status === "draft" || status === "declined") && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(record)} disabled={busy}>
                      <Pencil className="h-4 w-4" /> {status === "declined" ? "Revise" : "Edit"}
                    </Button>
                  )}
                  {status === "draft" && !approval && (
                    <Button size="sm" onClick={() => void prepareApproval(record)} disabled={busy}>
                      {workingId === `prepare:${record.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                      {workingId === `prepare:${record.id}` ? "Preparing…" : "Prepare approval"}
                    </Button>
                  )}
                  {approval && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/highlevel/estimates?edit=${encodeURIComponent(approval._id)}`}>Open approval <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  )}
                  {status === "draft" && approval?.status === "draft" && (
                    <Button size="sm" onClick={() => void sendApproval(record, approval)} disabled={busy}>
                      {workingId === `send:${record.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {workingId === `send:${record.id}` ? "Sending…" : "Send for approval"}
                    </Button>
                  )}
                  {status === "approved" && approval && !invoiceId && (
                    <Button size="sm" onClick={() => void createInvoice(record, approval)} disabled={busy}>
                      {workingId === `invoice:${record.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                      {workingId === `invoice:${record.id}` ? "Creating…" : "Create invoice"}
                    </Button>
                  )}
                  {status === "invoiced" && (
                    <Button size="sm" variant="outline" asChild><Link to="/highlevel/money?view=all"><Receipt className="h-4 w-4" /> Open invoices</Link></Button>
                  )}
                  {status === "draft" && !approvalId && (
                    <Button size="icon" variant="ghost" aria-label="Delete draft change order" onClick={() => void removeDraft(record)} disabled={busy}>
                      {workingId === `delete:${record.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(next) => { if (!saving) setFormOpen(next); }}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle>{editing ? "Revise change order" : "New change order"}</DialogTitle>
              <AiFormHelper<ChangeOrderAiValues>
                formName="change order"
                fields={[
                  { name: "change_order_name", description: "Short customer-facing name for the scope change" },
                  { name: "job_name", description: "Exact FastTract job name when provided" },
                  { name: "amount", type: "number", description: "Verified customer-facing change price only" },
                  { name: "tax_percent", type: "number", description: "Verified tax percentage only" },
                  { name: "requested_date", type: "date" },
                  { name: "description", description: "Clear customer-facing description of added, removed, or revised work" },
                  { name: "notes", description: "Internal access, crew, scheduling, or material notes" },
                ]}
                context={{
                  jobs: availableJobs.map((job) => ({
                    id: job.id,
                    name: jobName(job),
                    customerLinked: Boolean(readRecordString(job, jobPropertyKeys.customerId)),
                  })),
                  instruction: "Never invent price, tax, customer, measurements, or dates. Leave uncertain values blank or zero for review.",
                }}
                onFill={applyAiValues}
                placeholder="Example: Add two widened concrete steps to the Fletcher patio for $2,750, requested today. Pump access stays the same."
              />
            </div>
          </DialogHeader>

          <div className="grid gap-5">
            <Field label="Change order name">
              <Input value={form.change_order_name} onChange={(event) => setForm({ ...form, change_order_name: event.target.value })} placeholder="Add two concrete steps" />
            </Field>
            <Field label="Job">
              <Select value={form.job_id} onValueChange={(value) => setForm({ ...form, job_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select the job" /></SelectTrigger>
                <SelectContent>
                  {availableJobs.map((job) => {
                    const customerLinked = Boolean(readRecordString(job, jobPropertyKeys.customerId));
                    return (
                      <SelectItem key={job.id} value={job.id} disabled={!customerLinked}>
                        {jobName(job)}{customerLinked ? "" : " — link customer first"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Change price">
                <Input type="number" min="0" step="0.01" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="Tax %">
                <Input type="number" min="0" max="100" step="0.01" value={form.tax_percent || ""} onChange={(event) => setForm({ ...form, tax_percent: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="Requested date">
                <Input type="date" value={form.requested_date} onChange={(event) => setForm({ ...form, requested_date: event.target.value })} />
              </Field>
            </div>
            <Field label="Customer-facing scope change">
              <Textarea rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe exactly what is being added, removed, or changed and any schedule impact." />
            </Field>
            <Field label="Internal notes">
              <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Crew, access, supplier, or scheduling notes that should not appear in the customer approval." />
            </Field>
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Saving creates a FastTract draft only. Customer approval is a separate native HighLevel estimate that you review before sending.
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {saving ? "Saving…" : editing ? "Save revision" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ChangeSummary({ label, value, count }: { label: string; value: number; count: number }) {
  return (
    <div className="min-w-0 bg-card/55 p-4">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold">{money.format(value)}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{count} change{count === 1 ? "" : "s"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
