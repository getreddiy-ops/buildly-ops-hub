import type {
  FastTractLead,
  HighLevelEstimate,
  HighLevelInvoice,
  HighLevelRecord,
} from "@/integrations/highlevel/client";

export type DashboardTone = "critical" | "warning" | "primary" | "info" | "success" | "muted";
export type DashboardTaskKind = "lead" | "estimate" | "invoice" | "job";

export type DashboardTask = {
  id: string;
  kind: DashboardTaskKind;
  title: string;
  detail: string;
  status: string;
  tone: DashboardTone;
  actionLabel: string;
  to: string;
  priority: number;
  sortAt: number;
};

export type DashboardMetrics = {
  openLeads: number;
  hotLeads: number;
  activeJobs: number;
  draftEstimates: number;
  waitingEstimates: number;
  estimatePipelineValue: number;
  readyToInvoiceValue: number;
  outstandingInvoiceValue: number;
  overdueInvoiceValue: number;
};

export type DashboardModel = {
  metrics: DashboardMetrics;
  now: DashboardTask[];
  next: DashboardTask[];
  later: DashboardTask[];
  recommendedPrompt: string;
};

type DashboardInput = {
  leads: FastTractLead[];
  estimates: HighLevelEstimate[];
  invoices: HighLevelInvoice[];
  jobs: HighLevelRecord[];
  now?: Date;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dayMs = 24 * 60 * 60 * 1000;

function asTimestamp(value?: string | null, fallback = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDate(value?: string | null) {
  if (!value) return "No date set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function contactName(value?: { name?: string; email?: string; phoneNo?: string }) {
  return value?.name || value?.email || value?.phoneNo || "Customer";
}

function invoiceAmountDue(invoice: HighLevelInvoice) {
  const explicit = Number(invoice.amountDue);
  if (Number.isFinite(explicit)) return Math.max(explicit, 0);
  return Math.max((Number(invoice.total) || 0) - (Number(invoice.amountPaid) || 0), 0);
}

function readJobProperty(record: HighLevelRecord, keys: string[]) {
  const properties = record.properties ?? {};
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function jobStatus(record: HighLevelRecord) {
  return readJobProperty(record, [
    "custom_objects.jobs.status",
    "custom_object.jobs.status",
    "status",
  ]).toLowerCase() || "scheduled";
}

export function jobName(record: HighLevelRecord) {
  return readJobProperty(record, [
    "custom_objects.jobs.job_name",
    "custom_object.jobs.job_name",
    "job_name",
    "name",
    "title",
  ]) || "Untitled job";
}

export function jobStartDate(record: HighLevelRecord) {
  return readJobProperty(record, [
    "custom_objects.jobs.start_date",
    "custom_object.jobs.start_date",
    "start_date",
  ]);
}

function taskSort(a: DashboardTask, b: DashboardTask) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.sortAt - b.sortAt;
}

function leadTask(lead: FastTractLead): DashboardTask {
  const qualified = lead.status === "qualified";
  const newLead = lead.status === "new";
  return {
    id: `lead:${lead.id}`,
    kind: "lead",
    title: qualified ? `${lead.name} is ready for the next step` : `${lead.name} needs a response`,
    detail: [lead.status, lead.phone || lead.email || lead.source].filter(Boolean).join(" · ") || "No contact method saved",
    status: qualified ? "Qualified" : newLead ? "New lead" : "Follow up",
    tone: qualified ? "warning" : newLead ? "critical" : "info",
    actionLabel: "Open lead",
    to: `/highlevel/leads?edit=${encodeURIComponent(lead.id)}`,
    priority: qualified ? 20 : newLead ? 30 : 70,
    sortAt: 0,
  };
}

function estimateTask(estimate: HighLevelEstimate): DashboardTask | null {
  const amount = Number(estimate.total) || 0;
  const customer = contactName(estimate.contactDetails);
  const title = estimate.name || "Untitled estimate";
  const sortAt = asTimestamp(estimate.updatedAt || estimate.createdAt || estimate.issueDate);

  if (estimate.status === "accepted") {
    return {
      id: `estimate:${estimate._id}`,
      kind: "estimate",
      title: `${title} is ready to invoice`,
      detail: `${customer} · ${money.format(amount)}`,
      status: "Accepted",
      tone: "success",
      actionLabel: "Create invoice",
      to: "/highlevel/money",
      priority: 10,
      sortAt,
    };
  }

  if (estimate.status === "draft") {
    return {
      id: `estimate:${estimate._id}`,
      kind: "estimate",
      title: `Review ${title}`,
      detail: `${customer} · ${money.format(amount)}`,
      status: "Draft",
      tone: "warning",
      actionLabel: "Review",
      to: `/highlevel/estimates?edit=${encodeURIComponent(estimate._id)}`,
      priority: 40,
      sortAt,
    };
  }

  if (estimate.status === "sent" || estimate.status === "viewed") {
    return {
      id: `estimate:${estimate._id}`,
      kind: "estimate",
      title: `Waiting on ${customer}`,
      detail: `${title} · ${money.format(amount)}`,
      status: estimate.status === "viewed" ? "Viewed" : "Sent",
      tone: "info",
      actionLabel: "Open estimate",
      to: `/highlevel/estimates?edit=${encodeURIComponent(estimate._id)}`,
      priority: estimate.status === "viewed" ? 60 : 80,
      sortAt,
    };
  }

  return null;
}

function invoiceTask(invoice: HighLevelInvoice, today: number): { bucket: "now" | "next" | "later"; task: DashboardTask } | null {
  const due = invoiceAmountDue(invoice);
  if (invoice.status === "paid" || invoice.status === "void" || due <= 0) return null;

  const customer = contactName(invoice.contactDetails);
  const label = invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : invoice.name || "Invoice";
  const dueAt = asTimestamp(invoice.dueDate);
  const daysUntilDue = dueAt === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Math.floor((startOfDay(new Date(dueAt)) - today) / dayMs);
  const overdue = daysUntilDue < 0 && ["sent", "payment_processing", "partially_paid"].includes(invoice.status);
  const draft = invoice.status === "draft";

  const task: DashboardTask = {
    id: `invoice:${invoice._id}`,
    kind: "invoice",
    title: overdue ? `${label} is overdue` : draft ? `${label} is ready to send` : `${label} is still outstanding`,
    detail: `${customer} · ${money.format(due)}${invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ""}`,
    status: overdue ? "Overdue" : draft ? "Draft" : invoice.status.replace(/_/g, " "),
    tone: overdue ? "critical" : draft ? "warning" : "info",
    actionLabel: draft ? "Send invoice" : "Open money",
    to: "/highlevel/money",
    priority: overdue ? 0 : draft ? 35 : daysUntilDue <= 7 ? 50 : 90,
    sortAt: dueAt,
  };

  if (overdue) return { bucket: "now", task };
  if (draft || daysUntilDue <= 7) return { bucket: "next", task };
  return { bucket: "later", task };
}

function jobTask(record: HighLevelRecord, today: number): { bucket: "now" | "next" | "later"; task: DashboardTask } | null {
  const status = jobStatus(record);
  if (["complete", "completed", "cancelled", "canceled"].includes(status)) return null;

  const name = jobName(record);
  const startDate = jobStartDate(record);
  const startAt = asTimestamp(startDate, asTimestamp(record.updatedAt || record.dateUpdated));
  const daysUntilStart = startDate ? Math.floor((startOfDay(new Date(startAt)) - today) / dayMs) : Number.MAX_SAFE_INTEGER;
  const active = ["active", "in_progress", "in progress"].includes(status);
  const onHold = ["on_hold", "on hold"].includes(status);

  const task: DashboardTask = {
    id: `job:${record.id}`,
    kind: "job",
    title: active ? `${name} is in progress` : onHold ? `${name} is on hold` : `${name} is coming up`,
    detail: startDate ? `Starts ${formatDate(startDate)} · ${status.replace(/_/g, " ")}` : `No start date · ${status.replace(/_/g, " ")}`,
    status: active ? "Active" : onHold ? "On hold" : daysUntilStart <= 0 ? "Starts today" : "Scheduled",
    tone: active ? "primary" : onHold ? "warning" : daysUntilStart <= 1 ? "info" : "muted",
    actionLabel: "Open job",
    to: `/highlevel/jobs?open=${encodeURIComponent(record.id)}`,
    priority: active ? 25 : onHold ? 45 : daysUntilStart <= 1 ? 55 : 100,
    sortAt: startAt,
  };

  if (active || onHold || daysUntilStart <= 0) return { bucket: "now", task };
  if (daysUntilStart <= 7) return { bucket: "next", task };
  return { bucket: "later", task };
}

export function buildHighLevelDashboard(input: DashboardInput): DashboardModel {
  const nowDate = input.now ?? new Date();
  const today = startOfDay(nowDate);
  const now: DashboardTask[] = [];
  const next: DashboardTask[] = [];
  const later: DashboardTask[] = [];

  const openLeads = input.leads.filter((lead) => !["won", "lost"].includes(lead.status));
  for (const lead of openLeads) {
    const task = leadTask(lead);
    if (lead.status === "new" || lead.status === "qualified") now.push(task);
    else next.push(task);
  }

  for (const estimate of input.estimates) {
    const task = estimateTask(estimate);
    if (!task) continue;
    if (estimate.status === "accepted") now.push(task);
    else if (estimate.status === "draft") next.push(task);
    else later.push(task);
  }

  for (const invoice of input.invoices) {
    const result = invoiceTask(invoice, today);
    if (!result) continue;
    if (result.bucket === "now") now.push(result.task);
    else if (result.bucket === "next") next.push(result.task);
    else later.push(result.task);
  }

  for (const job of input.jobs) {
    const result = jobTask(job, today);
    if (!result) continue;
    if (result.bucket === "now") now.push(result.task);
    else if (result.bucket === "next") next.push(result.task);
    else later.push(result.task);
  }

  const activeJobs = input.jobs.filter((job) => !["complete", "completed", "cancelled", "canceled"].includes(jobStatus(job))).length;
  const outstandingInvoices = input.invoices.filter((invoice) =>
    ["sent", "payment_processing", "partially_paid", "draft"].includes(invoice.status) && invoiceAmountDue(invoice) > 0,
  );
  const overdueInvoices = outstandingInvoices.filter((invoice) => {
    if (invoice.status === "draft" || !invoice.dueDate) return false;
    const dueAt = asTimestamp(invoice.dueDate);
    return dueAt !== Number.MAX_SAFE_INTEGER && startOfDay(new Date(dueAt)) < today;
  });

  const metrics: DashboardMetrics = {
    openLeads: openLeads.length,
    hotLeads: openLeads.filter((lead) => lead.status === "qualified").length,
    activeJobs,
    draftEstimates: input.estimates.filter((estimate) => estimate.status === "draft").length,
    waitingEstimates: input.estimates.filter((estimate) => estimate.status === "sent" || estimate.status === "viewed").length,
    estimatePipelineValue: input.estimates
      .filter((estimate) => !["declined", "invoiced"].includes(estimate.status ?? ""))
      .reduce((sum, estimate) => sum + (Number(estimate.total) || 0), 0),
    readyToInvoiceValue: input.estimates
      .filter((estimate) => estimate.status === "accepted")
      .reduce((sum, estimate) => sum + (Number(estimate.total) || 0), 0),
    outstandingInvoiceValue: outstandingInvoices.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
    overdueInvoiceValue: overdueInvoices.reduce((sum, invoice) => sum + invoiceAmountDue(invoice), 0),
  };

  now.sort(taskSort);
  next.sort(taskSort);
  later.sort(taskSort);

  const topTask = now[0] ?? next[0] ?? later[0];
  const recommendedPrompt = topTask
    ? topTask.kind === "lead"
      ? "Help me follow up with the lead that needs attention first"
      : topTask.kind === "estimate"
        ? "Help me finish the most important estimate"
        : topTask.kind === "invoice"
          ? "Show me the money I need to collect first"
          : "Help me prepare for the next job"
    : "Show me the best next step for my business today";

  return { metrics, now, next, later, recommendedPrompt };
}
