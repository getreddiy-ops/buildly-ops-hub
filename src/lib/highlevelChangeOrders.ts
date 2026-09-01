import type {
  HighLevelEstimate,
  HighLevelRecord,
} from "@/integrations/highlevel/client";
import {
  jobName,
  jobPropertyKeys,
  readRecordNumber,
  readRecordString,
} from "./highlevelJobWorkspace";

export type FastTractChangeOrderStatus = "draft" | "sent" | "approved" | "declined" | "invoiced";

export type ChangeOrderForm = {
  change_order_name: string;
  job_id: string;
  amount: number;
  tax_percent: number;
  requested_date: string;
  description: string;
  notes: string;
};

export const changeOrderPropertyKeys = {
  name: [
    "custom_objects.change_orders.change_order_name",
    "custom_object.change_orders.change_order_name",
    "change_order_name",
    "name",
    "title",
  ],
  jobId: ["custom_objects.change_orders.job_id", "custom_object.change_orders.job_id", "job_id"],
  customerId: ["custom_objects.change_orders.customer_id", "custom_object.change_orders.customer_id", "customer_id"],
  originalEstimateId: ["custom_objects.change_orders.estimate_id", "custom_object.change_orders.estimate_id", "estimate_id"],
  approvalEstimateId: [
    "custom_objects.change_orders.approval_estimate_id",
    "custom_object.change_orders.approval_estimate_id",
    "approval_estimate_id",
  ],
  invoiceId: ["custom_objects.change_orders.invoice_id", "custom_object.change_orders.invoice_id", "invoice_id"],
  status: ["custom_objects.change_orders.status", "custom_object.change_orders.status", "status"],
  amount: ["custom_objects.change_orders.amount", "custom_object.change_orders.amount", "amount"],
  taxPercent: ["custom_objects.change_orders.tax_percent", "custom_object.change_orders.tax_percent", "tax_percent"],
  requestedDate: [
    "custom_objects.change_orders.requested_date",
    "custom_object.change_orders.requested_date",
    "requested_date",
  ],
  approvedDate: [
    "custom_objects.change_orders.approved_date",
    "custom_object.change_orders.approved_date",
    "approved_date",
  ],
  description: [
    "custom_objects.change_orders.description",
    "custom_object.change_orders.description",
    "description",
  ],
  notes: ["custom_objects.change_orders.notes", "custom_object.change_orders.notes", "notes"],
} as const;

const statusRank: Record<FastTractChangeOrderStatus, number> = {
  approved: 0,
  draft: 1,
  sent: 2,
  invoiced: 3,
  declined: 4,
};

function storedChangeOrderStatus(record: HighLevelRecord): FastTractChangeOrderStatus {
  const raw = readRecordString(record, changeOrderPropertyKeys.status).toLowerCase();
  if (raw === "sent" || raw === "approved" || raw === "declined" || raw === "invoiced") return raw;
  return "draft";
}

export function changeOrderName(record: HighLevelRecord) {
  return readRecordString(record, changeOrderPropertyKeys.name) || "Untitled change order";
}

export function changeOrderAmount(record: HighLevelRecord) {
  return Math.max(0, readRecordNumber(record, changeOrderPropertyKeys.amount));
}

export function changeOrderTaxPercent(record: HighLevelRecord) {
  return Math.min(100, Math.max(0, readRecordNumber(record, changeOrderPropertyKeys.taxPercent)));
}

export function changeOrderStatus(
  record: HighLevelRecord,
  approvalEstimate?: HighLevelEstimate | null,
): FastTractChangeOrderStatus {
  if (readRecordString(record, changeOrderPropertyKeys.invoiceId)) return "invoiced";
  if (approvalEstimate?.status === "invoiced") return "invoiced";
  if (approvalEstimate?.status === "accepted") return "approved";
  if (approvalEstimate?.status === "declined") return "declined";
  if (approvalEstimate?.status === "sent" || approvalEstimate?.status === "viewed") return "sent";
  return storedChangeOrderStatus(record);
}

export function changeOrderStatusLabel(status: FastTractChangeOrderStatus) {
  const labels: Record<FastTractChangeOrderStatus, string> = {
    draft: "Draft",
    sent: "Awaiting approval",
    approved: "Approved",
    declined: "Declined",
    invoiced: "Invoiced",
  };
  return labels[status];
}

export function approvalEstimateForChangeOrder(
  record: HighLevelRecord,
  estimates: HighLevelEstimate[],
) {
  const id = readRecordString(record, changeOrderPropertyKeys.approvalEstimateId);
  return id ? estimates.find((estimate) => estimate._id === id) ?? null : null;
}

export function linkedJobForChangeOrder(
  record: HighLevelRecord,
  jobs: HighLevelRecord[],
) {
  const jobId = readRecordString(record, changeOrderPropertyKeys.jobId);
  return jobId ? jobs.find((job) => job.id === jobId) ?? null : null;
}

export function changeOrderRecordPayload(
  form: ChangeOrderForm,
  job: HighLevelRecord,
  existing?: HighLevelRecord | null,
) {
  return {
    properties: {
      change_order_name: form.change_order_name.trim(),
      job_id: job.id,
      customer_id: readRecordString(job, jobPropertyKeys.customerId) || null,
      estimate_id: readRecordString(job, jobPropertyKeys.estimateId) || null,
      approval_estimate_id: existing
        ? readRecordString(existing, changeOrderPropertyKeys.approvalEstimateId) || null
        : null,
      invoice_id: existing
        ? readRecordString(existing, changeOrderPropertyKeys.invoiceId) || null
        : null,
      status: existing ? storedChangeOrderStatus(existing) : "draft",
      amount: Math.round(Math.max(0, Number(form.amount) || 0) * 100) / 100,
      tax_percent: Math.round(Math.min(100, Math.max(0, Number(form.tax_percent) || 0)) * 100) / 100,
      requested_date: form.requested_date || null,
      approved_date: existing
        ? readRecordString(existing, changeOrderPropertyKeys.approvedDate) || null
        : null,
      description: form.description.trim(),
      notes: form.notes.trim() || null,
    },
  };
}

export function changeOrderFormFromRecord(record: HighLevelRecord): ChangeOrderForm {
  return {
    change_order_name: changeOrderName(record),
    job_id: readRecordString(record, changeOrderPropertyKeys.jobId),
    amount: changeOrderAmount(record),
    tax_percent: changeOrderTaxPercent(record),
    requested_date: readRecordString(record, changeOrderPropertyKeys.requestedDate),
    description: readRecordString(record, changeOrderPropertyKeys.description),
    notes: readRecordString(record, changeOrderPropertyKeys.notes),
  };
}

export function approvalEstimatePayload(
  record: HighLevelRecord,
  job: HighLevelRecord,
) {
  const customerId = readRecordString(record, changeOrderPropertyKeys.customerId)
    || readRecordString(job, jobPropertyKeys.customerId);
  if (!customerId) throw new Error("Link a customer to this job before creating the approval estimate");

  const name = changeOrderName(record);
  const description = readRecordString(record, changeOrderPropertyKeys.description);
  const amount = changeOrderAmount(record);
  if (!description) throw new Error("Change order scope is required");
  if (amount <= 0) throw new Error("Change order amount must be greater than zero");

  return {
    title: `Change Order — ${name}`,
    customer_id: customerId,
    tax_percent: changeOrderTaxPercent(record),
    notes: [
      `CHANGE ORDER FOR: ${jobName(job)}`,
      description,
      "This work is outside the original agreed scope. The price and schedule may change only as described above.",
      "Work on this change will begin only after customer approval. All other terms of the original agreement remain in effect.",
    ].join("\n\n"),
    line_items: [
      {
        description: `${name}: ${description}`,
        quantity: 1,
        unit_price: amount,
      },
    ],
  };
}

export function changeOrderTotal(record: HighLevelRecord) {
  const subtotal = changeOrderAmount(record);
  return subtotal + subtotal * changeOrderTaxPercent(record) / 100;
}

export function sortChangeOrders(
  records: HighLevelRecord[],
  estimates: HighLevelEstimate[],
) {
  return [...records].sort((a, b) => {
    const aStatus = changeOrderStatus(a, approvalEstimateForChangeOrder(a, estimates));
    const bStatus = changeOrderStatus(b, approvalEstimateForChangeOrder(b, estimates));
    const statusDifference = statusRank[aStatus] - statusRank[bStatus];
    if (statusDifference !== 0) return statusDifference;

    const aDate = Date.parse(readRecordString(a, changeOrderPropertyKeys.requestedDate));
    const bDate = Date.parse(readRecordString(b, changeOrderPropertyKeys.requestedDate));
    const aValue = Number.isFinite(aDate) ? aDate : 0;
    const bValue = Number.isFinite(bDate) ? bDate : 0;
    if (aValue !== bValue) return bValue - aValue;
    return changeOrderName(a).localeCompare(changeOrderName(b));
  });
}

export function summarizeChangeOrders(
  records: HighLevelRecord[],
  estimates: HighLevelEstimate[],
) {
  const rows = records.map((record) => ({
    record,
    estimate: approvalEstimateForChangeOrder(record, estimates),
  }));
  const statusOf = ({ record, estimate }: typeof rows[number]) => changeOrderStatus(record, estimate);
  const awaiting = rows.filter((row) => statusOf(row) === "sent");
  const approved = rows.filter((row) => statusOf(row) === "approved");
  const draft = rows.filter((row) => statusOf(row) === "draft");
  const invoiced = rows.filter((row) => statusOf(row) === "invoiced");

  return {
    draftCount: draft.length,
    awaitingCount: awaiting.length,
    approvedCount: approved.length,
    invoicedCount: invoiced.length,
    draftValue: draft.reduce((sum, row) => sum + changeOrderTotal(row.record), 0),
    awaitingValue: awaiting.reduce((sum, row) => sum + changeOrderTotal(row.record), 0),
    approvedValue: approved.reduce((sum, row) => sum + changeOrderTotal(row.record), 0),
    invoicedValue: invoiced.reduce((sum, row) => sum + changeOrderTotal(row.record), 0),
  };
}
