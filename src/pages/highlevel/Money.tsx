import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Search,
  Send,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  highLevel,
  type HighLevelEstimate,
  type HighLevelInvoice,
} from "@/integrations/highlevel/client";
import {
  collectionPrompt,
  filterInvoices,
  invoiceAmountDue,
  invoiceAmountPaid,
  invoiceCustomer,
  invoiceIsOverdue,
  invoiceLabel,
  invoiceTotal,
  paymentProgress,
  summarizeMoney,
  type MoneyView,
} from "@/lib/highlevelMoney";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const moneyViews: Array<{ value: MoneyView; label: string }> = [
  { value: "action", label: "Action queue" },
  { value: "all", label: "All invoices" },
  { value: "draft", label: "Draft" },
  { value: "outstanding", label: "Outstanding" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

function validMoneyView(value: string | null): value is MoneyView {
  return moneyViews.some((item) => item.value === value);
}

function formatDate(value?: string) {
  if (!value) return "No due date";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function HighLevelMoney() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [estimates, setEstimates] = useState<HighLevelEstimate[]>([]);
  const [invoices, setInvoices] = useState<HighLevelInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rawView = searchParams.get("view");
  const view: MoneyView = validMoneyView(rawView) ? rawView : "action";

  const setView = (nextView: MoneyView) => {
    const next = new URLSearchParams(searchParams);
    if (nextView === "action") next.delete("view");
    else next.set("view", nextView);
    setSearchParams(next, { replace: true });
  };

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

  const summary = useMemo(() => summarizeMoney(estimates, invoices), [estimates, invoices]);
  const visibleInvoices = useMemo(() => filterInvoices(invoices, view, query), [invoices, query, view]);
  const readyEstimates = useMemo(() => [...summary.readyEstimates].sort(
    (a, b) => (Number(b.total) || 0) - (Number(a.total) || 0),
  ), [summary.readyEstimates]);
  const actionCount = summary.draftInvoices.length + summary.outstandingInvoices.length;

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

  const scrollToReady = () => {
    document.getElementById("ready-to-invoice")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Money"
        description="See what is ready to bill, what needs collecting, and what has already been paid."
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
        <MoneyFilterCard
          icon={FileText}
          label="Ready to invoice"
          value={loading ? "—" : money.format(summary.readyValue)}
          detail={loading ? "Loading" : `${summary.readyEstimates.length} accepted estimate${summary.readyEstimates.length === 1 ? "" : "s"}`}
          active={false}
          alert={summary.readyValue > 0}
          onClick={scrollToReady}
        />
        <MoneyFilterCard
          icon={BadgeDollarSign}
          label="Outstanding"
          value={loading ? "—" : money.format(summary.outstandingValue)}
          detail={loading ? "Loading" : `${summary.outstandingInvoices.length} customer balance${summary.outstandingInvoices.length === 1 ? "" : "s"}`}
          active={view === "outstanding"}
          alert={summary.outstandingValue > 0}
          onClick={() => setView("outstanding")}
        />
        <MoneyFilterCard
          icon={Clock3}
          label="Overdue"
          value={loading ? "—" : money.format(summary.overdueValue)}
          detail={loading ? "Loading" : `${summary.overdueInvoices.length} past due`}
          active={view === "overdue"}
          alert={summary.overdueValue > 0}
          onClick={() => setView("overdue")}
        />
        <MoneyFilterCard
          icon={CheckCircle2}
          label="Paid"
          value={loading ? "—" : money.format(summary.paidValue)}
          detail={loading ? "Loading" : `${summary.paidInvoices.length} paid invoice${summary.paidInvoices.length === 1 ? "" : "s"}`}
          active={view === "paid"}
          onClick={() => setView("paid")}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{loading ? "Checking the money queue…" : actionCount > 0 ? `${actionCount} invoice action${actionCount === 1 ? "" : "s"} need attention.` : "The invoice action queue is clear."}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.draftInvoices.length > 0 ? `${summary.draftInvoices.length} draft worth ${money.format(summary.draftValue)}. ` : ""}
            {summary.overdueInvoices.length > 0 ? `${summary.overdueInvoices.length} overdue balance${summary.overdueInvoices.length === 1 ? "" : "s"}.` : "No overdue balances."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setView("action")}>Show action queue</Button>
      </div>

      {warnings.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{warnings.join(" ")}</span>
        </div>
      )}

      <section id="ready-to-invoice" className="mt-7 scroll-mt-28 overflow-hidden rounded-xl border border-primary/25 bg-card/50 shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Ready to invoice</h2>
            <p className="mt-1 text-xs text-muted-foreground">Accepted estimates stay linked to the customer when FastTract creates the native HighLevel invoice.</p>
          </div>
          <FileText className="h-5 w-5 shrink-0 text-primary" />
        </div>
        {loading ? (
          <div className="h-24 animate-pulse bg-muted/20" />
        ) : readyEstimates.length === 0 ? (
          <div className="p-7 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <h3 className="mt-3 font-semibold">No accepted estimates are waiting</h3>
            <p className="mt-2 text-sm text-muted-foreground">Accepted work will appear here automatically, ready to become an invoice.</p>
            <Button className="mt-4" size="sm" variant="outline" asChild><Link to="/highlevel/estimates">Open estimates</Link></Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {readyEstimates.map((estimate) => {
              const actionId = `estimate:${estimate._id}`;
              return (
                <div key={estimate._id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{estimate.name || "Accepted estimate"}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{estimate.contactDetails?.name || estimate.contactDetails?.email || "Customer not assigned"}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold">{money.format(Number(estimate.total) || 0)}</span>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/highlevel/estimates?edit=${encodeURIComponent(estimate._id)}`}>Review</Link>
                    </Button>
                    <Button size="sm" onClick={() => void convertEstimate(estimate)} disabled={workingId === actionId}>
                      {workingId === actionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                      {workingId === actionId ? "Creating…" : "Create invoice"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7 overflow-hidden rounded-xl border border-border bg-card/40">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">Invoice queue</h2>
              <p className="mt-1 text-xs text-muted-foreground">Overdue and draft invoices stay at the top so the next money action is obvious.</p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 sm:w-60">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" placeholder="Search invoices…" />
              </div>
              <Select value={view} onValueChange={(value) => setView(value as MoneyView)}>
                <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{moneyViews.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-muted/40" />)}</div>
        ) : visibleInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <WalletCards className="mx-auto h-9 w-9 text-primary" />
            <h3 className="mt-4 font-semibold">No invoices in this view</h3>
            <p className="mt-2 text-sm text-muted-foreground">Change the filter, clear the search, or create an invoice from accepted work.</p>
            <Button className="mt-5" variant="outline" onClick={() => { setQuery(""); setView("all"); }}>Show all invoices</Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleInvoices.map((invoice) => {
              const overdue = invoiceIsOverdue(invoice);
              const actionId = `invoice:${invoice._id}`;
              const due = invoiceAmountDue(invoice);
              const paid = invoiceAmountPaid(invoice);
              const total = invoiceTotal(invoice);
              const progress = paymentProgress(invoice);
              const openBalance = due > 0 && invoice.status !== "draft" && invoice.status !== "void";
              return (
                <article key={invoice._id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      overdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                    )}><Receipt className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-medium">{invoiceLabel(invoice)}</h3>
                        <StatusBadge status={overdue ? "overdue" : invoice.status} />
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {invoiceCustomer(invoice)}{invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : " · No due date"}
                      </p>
                      {(paid > 0 || invoice.status === "paid") && total > 0 && (
                        <div className="mt-3 max-w-xl">
                          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                            <span>{money.format(paid)} paid</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-right sm:w-72">
                      <Amount label="Total" value={money.format(total)} />
                      <Amount label="Paid" value={money.format(paid)} />
                      <Amount label="Due" value={money.format(due)} alert={overdue} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                    {invoice.status === "draft" && (
                      <Button size="sm" onClick={() => void sendInvoice(invoice)} disabled={workingId === actionId}>
                        {workingId === actionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {workingId === actionId ? "Sending…" : "Send invoice"}
                      </Button>
                    )}
                    {openBalance && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/highlevel/ai?prompt=${encodeURIComponent(collectionPrompt(invoice))}`}>
                          <Sparkles className="h-4 w-4 text-primary" /> Draft reminder
                        </Link>
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MoneyFilterCard({
  icon: Icon,
  label,
  value,
  detail,
  active,
  alert = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  active: boolean;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-xl border p-4 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5",
        active || alert ? "border-primary/35 bg-primary/10" : "border-border bg-card/50 hover:bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs leading-5 text-muted-foreground sm:text-sm">{label}</span>
        <Icon className={cn("h-5 w-5 shrink-0", active || alert ? "text-primary" : "text-muted-foreground")} />
      </div>
      <p className="mt-4 truncate text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className={cn("mt-1 truncate text-[11px] sm:text-xs", active || alert ? "text-primary" : "text-muted-foreground")}>{detail}</p>
    </button>
  );
}

function Amount({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold", alert && "text-destructive")}>{value}</p>
    </div>
  );
}
