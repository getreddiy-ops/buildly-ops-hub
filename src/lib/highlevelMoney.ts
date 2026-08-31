import type { HighLevelEstimate, HighLevelInvoice } from "@/integrations/highlevel/client";

export type MoneyView = "action" | "all" | "draft" | "outstanding" | "overdue" | "paid";

export type MoneySummary = {
  readyEstimates: HighLevelEstimate[];
  readyValue: number;
  draftInvoices: HighLevelInvoice[];
  draftValue: number;
  outstandingInvoices: HighLevelInvoice[];
  outstandingValue: number;
  overdueInvoices: HighLevelInvoice[];
  overdueValue: number;
  paidInvoices: HighLevelInvoice[];
  paidValue: number;
};

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function invoiceTotal(invoice: HighLevelInvoice) {
  const value = Number(invoice.total);
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function invoiceAmountPaid(invoice: HighLevelInvoice) {
  const value = Number(invoice.amountPaid);
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function invoiceAmountDue(invoice: HighLevelInvoice) {
  const explicit = Number(invoice.amountDue);
  if (Number.isFinite(explicit)) return Math.max(explicit, 0);
  return Math.max(invoiceTotal(invoice) - invoiceAmountPaid(invoice), 0);
}

export function invoiceIsOverdue(invoice: HighLevelInvoice, now = new Date()) {
  if (!["sent", "payment_processing", "partially_paid"].includes(invoice.status)) return false;
  if (!invoice.dueDate || invoiceAmountDue(invoice) <= 0) return false;
  const due = Date.parse(invoice.dueDate);
  return Number.isFinite(due) && startOfDay(new Date(due)) < startOfDay(now);
}

export function paymentProgress(invoice: HighLevelInvoice) {
  const total = invoiceTotal(invoice);
  if (invoice.status === "paid") return 100;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, invoiceAmountPaid(invoice) / total * 100));
}

function dueTimestamp(invoice: HighLevelInvoice) {
  if (!invoice.dueDate) return Number.MAX_SAFE_INTEGER;
  const value = Date.parse(invoice.dueDate);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function issueTimestamp(invoice: HighLevelInvoice) {
  const raw = invoice.issueDate || invoice.createdAt || invoice.updatedAt;
  if (!raw) return 0;
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

function invoiceRank(invoice: HighLevelInvoice, now: Date) {
  if (invoiceIsOverdue(invoice, now)) return 0;
  if (invoice.status === "draft") return 1;
  if (invoice.status === "partially_paid") return 2;
  if (invoice.status === "payment_processing") return 3;
  if (invoice.status === "sent") return 4;
  if (invoice.status === "paid") return 5;
  return 6;
}

export function sortInvoices(invoices: HighLevelInvoice[], now = new Date()) {
  return [...invoices].sort((a, b) => {
    const rankDifference = invoiceRank(a, now) - invoiceRank(b, now);
    if (rankDifference !== 0) return rankDifference;

    const dueDifference = dueTimestamp(a) - dueTimestamp(b);
    if (dueDifference !== 0) return dueDifference;

    return issueTimestamp(b) - issueTimestamp(a);
  });
}

export function summarizeMoney(
  estimates: HighLevelEstimate[],
  invoices: HighLevelInvoice[],
  now = new Date(),
): MoneySummary {
  const readyEstimates = estimates.filter((estimate) => estimate.status === "accepted");
  const draftInvoices = invoices.filter((invoice) => invoice.status === "draft");
  const outstandingInvoices = invoices.filter((invoice) =>
    ["sent", "payment_processing", "partially_paid"].includes(invoice.status)
    && invoiceAmountDue(invoice) > 0,
  );
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoiceIsOverdue(invoice, now));
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");

  return {
    readyEstimates,
    readyValue: readyEstimates.reduce((sum, estimate) => sum + (Number(estimate.total) || 0), 0),
    draftInvoices,
    draftValue: draftInvoices.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
    outstandingInvoices,
    outstandingValue: outstandingInvoices.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
    overdueInvoices,
    overdueValue: overdueInvoices.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
    paidInvoices,
    paidValue: paidInvoices.reduce((sum, invoice) => sum + Math.max(invoiceAmountPaid(invoice), invoiceTotal(invoice)), 0),
  };
}

function matchesQuery(invoice: HighLevelInvoice, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    invoice.name,
    String(invoice.invoiceNumber ?? ""),
    invoice.contactDetails?.name,
    invoice.contactDetails?.email,
    invoice.contactDetails?.phoneNo,
  ].some((value) => value?.toLowerCase().includes(needle));
}

export function filterInvoices(
  invoices: HighLevelInvoice[],
  view: MoneyView,
  query = "",
  now = new Date(),
) {
  return sortInvoices(invoices, now).filter((invoice) => {
    if (!matchesQuery(invoice, query)) return false;
    if (view === "all") return true;
    if (view === "draft") return invoice.status === "draft";
    if (view === "outstanding") {
      return ["sent", "payment_processing", "partially_paid"].includes(invoice.status)
        && invoiceAmountDue(invoice) > 0;
    }
    if (view === "overdue") return invoiceIsOverdue(invoice, now);
    if (view === "paid") return invoice.status === "paid";
    return invoice.status === "draft"
      || (["sent", "payment_processing", "partially_paid"].includes(invoice.status)
        && invoiceAmountDue(invoice) > 0);
  });
}

export function invoiceCustomer(invoice: HighLevelInvoice) {
  return invoice.contactDetails?.name
    || invoice.contactDetails?.email
    || invoice.contactDetails?.phoneNo
    || "Customer";
}

export function invoiceLabel(invoice: HighLevelInvoice) {
  return invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : invoice.name || "Invoice";
}

export function collectionPrompt(invoice: HighLevelInvoice, now = new Date()) {
  const label = invoiceLabel(invoice);
  const customer = invoiceCustomer(invoice);
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(invoiceAmountDue(invoice));
  const due = invoice.dueDate ? ` due ${invoice.dueDate}` : "";
  const situation = invoiceIsOverdue(invoice, now) ? "overdue" : "outstanding";

  return `Draft a polite payment reminder for ${customer} about ${label}, an ${situation} balance of ${amount}${due}. Show me the message for approval and do not send it yet.`;
}
