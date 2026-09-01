import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Loader2,
  Receipt,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  highLevel,
  type HighLevelEstimate,
  type HighLevelRecord,
} from "@/integrations/highlevel/client";
import {
  jobName,
  jobPropertyKeys,
  jobStatus,
  readRecordString,
} from "@/lib/highlevelJobWorkspace";
import { toast } from "sonner";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function nestedId(value: unknown, keys: string[], depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  for (const key of ["invoice", "estimate", "record", "data", "result"]) {
    const found = nestedId(record[key], keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function linkedJob(estimate: HighLevelEstimate, jobs: HighLevelRecord[]) {
  return jobs.find((job) => readRecordString(job, jobPropertyKeys.estimateId) === estimate._id) ?? null;
}

function jobUpdatePayload(job: HighLevelRecord, invoiceId: string) {
  return {
    properties: {
      job_name: jobName(job),
      status: jobStatus(job),
      address: readRecordString(job, jobPropertyKeys.address) || null,
      start_date: readRecordString(job, jobPropertyKeys.startDate) || null,
      notes: readRecordString(job, jobPropertyKeys.notes) || null,
      customer_id: readRecordString(job, jobPropertyKeys.customerId) || null,
      estimate_id: readRecordString(job, jobPropertyKeys.estimateId) || null,
      invoice_id: invoiceId,
    },
  };
}

export function AcceptedWorkPanel({
  estimates,
  jobs,
  loading,
  jobsSetupRequired,
  onChanged,
}: {
  estimates: HighLevelEstimate[];
  jobs: HighLevelRecord[];
  loading: boolean;
  jobsSetupRequired: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [workingId, setWorkingId] = useState<string | null>(null);
  const ordered = useMemo(() => [...estimates].sort(
    (a, b) => (Number(b.total) || 0) - (Number(a.total) || 0),
  ), [estimates]);

  const createJob = async (estimate: HighLevelEstimate) => {
    if (linkedJob(estimate, jobs)) {
      toast.info("A FastTract job is already linked to this estimate");
      return;
    }
    const customerId = estimate.contactDetails?.id;
    if (!customerId) {
      toast.error("This accepted estimate is missing its HighLevel customer link");
      return;
    }
    if (!window.confirm(`Create a FastTract job for “${estimate.name || "this accepted estimate"}”?`)) return;

    setWorkingId(`job:${estimate._id}`);
    try {
      if (jobsSetupRequired) {
        const setup = await highLevel.bootstrap();
        if (!setup.ok && setup.errors?.length) throw new Error(setup.errors.join(" "));
      }
      const result = await highLevel.createRecord("jobs", {
        properties: {
          job_name: estimate.name || "Accepted work",
          status: "scheduled",
          address: null,
          start_date: null,
          notes: estimate.termsNotes || "Created from an accepted HighLevel estimate.",
          customer_id: customerId,
          estimate_id: estimate._id,
          invoice_id: null,
        },
      });
      toast.success("FastTract job created", {
        description: `${jobName(result.record)} is ready for scheduling, labor, materials, and change orders.`,
      });
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the FastTract job");
    } finally {
      setWorkingId(null);
    }
  };

  const createInvoice = async (estimate: HighLevelEstimate, job: HighLevelRecord) => {
    const existingInvoiceId = readRecordString(job, jobPropertyKeys.invoiceId);
    if (existingInvoiceId) {
      toast.info("This accepted work is already linked to an invoice");
      return;
    }
    if (!window.confirm(`Create a native HighLevel invoice from “${estimate.name || "this estimate"}”?`)) return;

    setWorkingId(`invoice:${estimate._id}`);
    try {
      const result = await highLevel.convertEstimateToInvoice(estimate._id);
      const invoiceId = nestedId(result, ["_id", "id"]);
      if (!invoiceId) throw new Error("HighLevel did not return the new invoice id");
      await highLevel.updateRecord("jobs", job.id, jobUpdatePayload(job, invoiceId));
      toast.success("Invoice created and linked to the job");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the invoice");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section id="ready-to-invoice" className="mt-7 scroll-mt-28 overflow-hidden rounded-xl border border-primary/25 bg-card/50 shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-border p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Accepted work</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Create the operating job first, then create and link the native HighLevel invoice.
          </p>
        </div>
        <FileText className="h-5 w-5 shrink-0 text-primary" />
      </div>

      {loading ? (
        <div className="space-y-3 p-5">{[0, 1].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-muted/30" />)}</div>
      ) : ordered.length === 0 ? (
        <div className="p-7 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <h3 className="mt-3 font-semibold">No accepted estimates are waiting</h3>
          <p className="mt-2 text-sm text-muted-foreground">Accepted customer work will appear here automatically.</p>
          <Button className="mt-4" size="sm" variant="outline" asChild><Link to="/highlevel/estimates">Open estimates</Link></Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {ordered.map((estimate) => {
            const job = linkedJob(estimate, jobs);
            const invoiceId = job ? readRecordString(job, jobPropertyKeys.invoiceId) : "";
            const creatingJob = workingId === `job:${estimate._id}`;
            const creatingInvoice = workingId === `invoice:${estimate._id}`;
            return (
              <article key={estimate._id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{estimate.name || "Accepted estimate"}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {estimate.contactDetails?.name || estimate.contactDetails?.email || "Customer not assigned"}
                      {job ? ` · Job: ${jobName(job)}` : " · Job not created"}
                    </p>
                  </div>
                  <p className="text-xl font-semibold">{money.format(Number(estimate.total) || 0)}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/highlevel/estimates?edit=${encodeURIComponent(estimate._id)}`}>Review estimate</Link>
                  </Button>
                  {!job ? (
                    <Button size="sm" onClick={() => void createJob(estimate)} disabled={creatingJob}>
                      {creatingJob ? <Loader2 className="h-4 w-4 animate-spin" /> : jobsSetupRequired ? <Wrench className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}
                      {creatingJob ? "Creating…" : jobsSetupRequired ? "Set up & create job" : "Create job"}
                    </Button>
                  ) : invoiceId ? (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/highlevel/jobs?open=${encodeURIComponent(job.id)}`}><BriefcaseBusiness className="h-4 w-4" /> Open job</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/highlevel/money?view=all"><Receipt className="h-4 w-4" /> Invoice linked</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/highlevel/jobs?open=${encodeURIComponent(job.id)}`}><BriefcaseBusiness className="h-4 w-4" /> Open job</Link>
                      </Button>
                      <Button size="sm" onClick={() => void createInvoice(estimate, job)} disabled={creatingInvoice}>
                        {creatingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                        {creatingInvoice ? "Creating…" : "Create invoice"}
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 border-t border-border bg-background/30 p-4 text-xs leading-5 text-muted-foreground">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        The linked job carries the original estimate and invoice IDs so labor, materials, change orders, and customer billing stay together.
      </div>
    </section>
  );
}
