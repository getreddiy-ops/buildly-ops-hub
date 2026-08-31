import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Send,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  highLevel,
  type HighLevelEstimate,
  type HighLevelInvoice,
} from "@/integrations/highlevel/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function invoiceAmountDue(invoice: HighLevelInvoice) {
  const explicit = Number(invoice.amountDue);
  if (Number.isFinite(explicit)) return Math.max(explicit, 0);
  return Math.max((Number(invoice.total) || 0) - (Number(invoice.amountPaid) || 0), 0);
}

function invoiceIsOverdue(invoice: HighLevelInvoice) {
  if (!["sent", "payment_processing", "partially_paid"].includes(invoice.status)) return false;
  if (!invoice.dueDate || invoiceAmountDue(invoice) <= 0) return false;
  const due = Date.parse(invoice.dueDate);
  return Number.isFinite(due) && due < new Date().setHours(0, 0, 0, 0);
}

function formatDate(value?: string) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function HighLevelMoney() {
  const [estimates, setEstimates] = useState<HighLevelEstimate[]>([]);
  const [invoices, setInvoices] = useState<HighLevelInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [estimateResult, invoiceResult] = await Promise.allSettled([
      highLevel.listEstimates({ limit: 100, status: "all" }),
      highLevel.listInvoices({ limit: 100, status: "all" }),
    ]);

    const nextWarnings: string[] = [];
    if (estimateResult.status === "fulfilled") {
      setEstimates(estimateResult.value.estimates ?? []);
    } else {
      setEstimates([]);
      nextWarnings.push("Estimate totals are temporarily unavailable.");
    }

    if (invoiceResult.status === "fulfilled") {
      setInvoices(invoiceResult.value.invoices ?? []);
    } else {
      setInvoices([]);
      nextWarnings.push("Invoices are temporarily unavailable. Confirm that the HighLevel app includes invoice scopes.");
    }

    setWarnings(nextWarnings);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const ready = estimates.filter((estimate) => estimate.status === "accepted");
    const outstanding = invoices.filter((invoice) =>
      ["sent", "payment_processing", "partially_paid"].includes(invoice.status) && invoiceAmountDue(invoice) > 0,
    );
    const overdue = outstanding.filter(invoiceIsOverdue);
    const paid = invoices.filter((invoice) => invoice.status === "paid");

    return {
      ready,
      readyValue: ready.reduce((sum, estimate) => sum + (Number(estimate.total) || 0), 0),
      outstanding,
      outstandingValue: outstanding.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
      overdue,
      overdueValue: overdue.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
      paid,
      paidValue: paid.reduce((sum, invoice) => sum + (Number(invoice.amountPaid) || Number(invoice.total) || 0), 0),
    };
  }, [estimates, invoices]);

  const convertEstimate = async (estimate: HighLevelEstimate) => {
    if (!window.confirm(`Create a HighLevel invoice from “${estimate.name || "this estimate"}”?`)) return;
    const actionId = `estimate:${estimate._id}`;
    setWorkingId(actionId);
    try {
      const result = await highLevel.convertEstimateToInvoice(estimate._id);
      toast.success("Invoice created in HighLevel", {
        description: result.invoice?.name || estimate.name || "The accepted estimate is now an invoice.",
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the invoice");
    } finally {
      setWorkingId(null);
    }
  };

  const sendInvoice = async (invoice: HighLevelInvoice) => {
    if (!window.confirm(`Send “${invoice.name || "this invoice"}” by SMS and email?`)) return;
    const actionId = `invoice:${invoice._id}`;
    setWorkingId(actionId);
    try {
      await highLevel.sendInvoice(invoice._id, { channel: "sms_and_email" });
      toast.success("Invoice sent by SMS and email");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the invoice");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Money"
        description="Move approved work from estimate to invoice to paid—without leaving FastTract."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Button asChild><Link to="/highlevel/estimates">Open estimates <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MoneyCard
          icon={FileText}
          label="Ready to invoice"
          value={loading ? "—" : money.format(summary.readyValue)}
          detail={loading ? "Loading" : `${summary.ready.length} accepted estimate${summary.ready.length === 1 ? "" : "s"}`}
        />
        <MoneyCard
          icon={BadgeDollarSign}
          label="Outstanding"
          value={loading ? "—" : money.format(summary.outstandingValue)}
          detail={loading ? "Loading" : `${summary.outstanding.length} open invoice${summary.outstanding.length === 1 ? "" : "s"}`}
        />
        <MoneyCard
          icon={Clock3}
          label="Overdue"
          value={loading ? "—" : money.format(summary.overdueValue)}
          detail={loading ? "Loading" : `${summary.overdue.length} past due`}
        />
        <MoneyCard
          icon={CheckCircle2}
          label="Paid"
          value={loading ? "—" : money.format(summary.paidValue)}
          detail={loading ? "Loading" : `${summary.paid.length} paid invoice${summary.paid.length === 1 ? "" : "s"}`}
        />
      </div>

      {warnings.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{warnings.join(" ")}</span>
        </div>
      )}

      {summary.ready.length > 0 && (
        <section className="mt-7 overflow-hidden rounded-xl border border-primary/25 bg-card/50 shadow-card">
          <div className="border-b border-border p-4 sm:p-5">
            <h2 className="font-semibold">Ready to invoice</h2>
            <p className="mt-1 text-xs text-muted-foreground">Accepted estimates stay linked to the customer when FastTract creates the native HighLevel invoice.</p>
          </div>
          <div className="divide-y divide-border">
            {summary.ready.map((estimate) => {
              const actionId = `estimate:${estimate._id}`;
              return (
                <div key={estimate._id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{estimate.name || "Accepted estimate"}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{estimate.contactDetails?.name || estimate.contactDetails?.email || "Customer not assigned"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="font-semibold">{money.format(Number(estimate.total) || 0)}</span>
                    <Button size="sm" onClick={() => void convertEstimate(estimate)} disabled={workingId === actionId}>
                      {workingId === actionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                      {workingId === actionId ? "Creating…" : "Create invoice"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-7 overflow-hidden rounded-xl border border-border bg-card/40">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Invoices</h2>
            <p className="mt-1 text-xs text-muted-foreground">Native HighLevel invoice status, amount due, and delivery actions.</p>
          </div>
          <Receipt className="h-5 w-5 text-primary" />
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-muted/40" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <WalletCards className="mx-auto h-9 w-9 text-primary" />
            <h3 className="mt-4 font-semibold">No invoices yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Accept an estimate, then create the invoice here in one step.</p>
            <Button className="mt-5" variant="outline" asChild><Link to="/highlevel/estimates">Open estimates</Link></Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {invoices.map((invoice) => {
              const overdue = invoiceIsOverdue(invoice);
              const actionId = `invoice:${invoice._id}`;
              const label = invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : invoice.name || "Invoice";
              return (
                <div key={invoice._id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Receipt className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{label}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {invoice.contactDetails?.name || invoice.contactDetails?.email || "Customer not assigned"}
                      {invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <StatusBadge status={overdue ? "overdue" : invoice.status} />
                    <div className="min-w-24 text-right">
                      <p className="font-semibold">{money.format(invoiceAmountDue(invoice))}</p>
                      <p className="text-[11px] text-muted-foreground">amount due</p>
                    </div>
                    {invoice.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => void sendInvoice(invoice)} disabled={workingId === actionId}>
                        {workingId === actionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {workingId === actionId ? "Sending…" : "Send"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MoneyCard({ icon: Icon, label, value, detail }: { icon: typeof FileText; label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/50 p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs leading-5 text-muted-foreground sm:text-sm">{label}</span>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </div>
      <p className="mt-4 truncate text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{detail}</p>
    </div>
  );
}
