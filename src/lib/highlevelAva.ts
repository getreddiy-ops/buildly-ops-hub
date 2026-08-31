import type {
  FastTractLead,
  HighLevelEstimate,
  HighLevelInvoice,
  HighLevelRecord,
} from "@/integrations/highlevel/client";
import { buildHighLevelDashboard } from "./highlevelDashboard";
import { summarizeMoney } from "./highlevelMoney";

export type AvaIntent =
  | "create_estimate"
  | "create_job"
  | "create_lead"
  | "create_customer"
  | "review_leads"
  | "review_jobs"
  | "review_money"
  | "find_customer"
  | "add_time"
  | "add_material"
  | "update_job"
  | "follow_up_invoice"
  | "other";

export type AvaDraftResult = {
  intent?: AvaIntent;
  summary?: string;
  next_step?: string;
  draft_content?: string;
  missing_information?: unknown;
  requires_approval?: boolean;
};

export type AvaPlan = {
  intent: AvaIntent;
  summary: string;
  nextStep: string;
  draftContent: string;
  missingInformation: string[];
  requiresApproval: boolean;
  actionLabel: string;
  route: string;
};

export type AvaBusinessSnapshot = {
  openLeads: number;
  qualifiedLeads: number;
  activeJobs: number;
  draftEstimates: number;
  waitingEstimates: number;
  acceptedEstimateValue: number;
  draftInvoiceValue: number;
  outstandingInvoiceValue: number;
  overdueInvoiceValue: number;
  topPriority: string | null;
};

type SnapshotInput = {
  leads: FastTractLead[];
  estimates: HighLevelEstimate[];
  invoices: HighLevelInvoice[];
  jobs: HighLevelRecord[];
  now?: Date;
};

const intents: AvaIntent[] = [
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

function hasAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function inferAvaIntent(prompt: string): AvaIntent {
  const value = prompt.trim().toLowerCase();
  if (!value) return "other";

  if (hasAny(value, [
    /\b(payment reminder|invoice reminder|past due|overdue|collect|collection|chase payment|follow up on (?:an )?invoice)\b/,
    /\bremind\b.*\b(pay|payment|invoice|balance)\b/,
  ])) return "follow_up_invoice";

  if (hasAny(value, [
    /\b(add|log|record|enter)\b.*\b(hours?|time|labor)\b/,
    /\bclock(?:ed)?\b.*\b(hours?|time)\b/,
  ])) return "add_time";

  if (hasAny(value, [
    /\b(add|log|record|enter|order)\b.*\b(materials?|supplies|concrete|rebar|lumber)\b/,
  ])) return "add_material";

  if (hasAny(value, [
    /\b(create|start|schedule|open|make|new)\b.*\bjob\b/,
    /\bturn\b.*\b(estimate|work)\b.*\binto (?:a )?job\b/,
  ])) return "create_job";

  if (hasAny(value, [
    /\b(update|change|move|mark|close|complete|hold|reschedule)\b.*\bjob\b/,
    /\bjob\b.*\b(status|schedule|date)\b/,
  ])) return "update_job";

  if (hasAny(value, [
    /\b(create|add|capture|new)\b.*\b(lead|prospect|inquiry)\b/,
    /\b(lead|prospect|inquiry)\b.*\b(name|phone|email|called|requested)\b/,
  ])) return "create_lead";

  if (hasAny(value, [
    /\b(create|add|new)\b.*\b(customer|client)\b/,
  ])) return "create_customer";

  if (hasAny(value, [
    /\b(estimate|bid|quote|proposal)\b/,
    /\bprice\b.*\b(job|work|project)\b/,
  ])) return "create_estimate";

  if (hasAny(value, [
    /\b(find|search|look up|locate|open)\b.*\b(customer|client)\b/,
  ])) return "find_customer";

  if (hasAny(value, [
    /\b(leads?|prospects?|callbacks?|inquiries)\b/,
    /\bwho\b.*\b(call back|follow up|contact)\b/,
  ])) return "review_leads";

  if (hasAny(value, [
    /\b(jobs?|projects?|crew schedule|work schedule)\b/,
  ])) return "review_jobs";

  if (hasAny(value, [
    /\b(money|cash|cashflow|revenue|receivables?|invoices?|paid|unpaid|outstanding|billing)\b/,
  ])) return "review_money";

  return "other";
}

function encodedPrompt(prompt: string) {
  return encodeURIComponent(prompt.trim());
}

export function routeForAvaIntent(intent: AvaIntent, prompt: string) {
  const encoded = encodedPrompt(prompt);
  if (intent === "create_estimate") return `/highlevel/estimates?prompt=${encoded}`;
  if (intent === "create_job") return `/highlevel/jobs?new=1&prompt=${encoded}`;
  if (intent === "create_lead") return `/highlevel/leads?new=1&prompt=${encoded}`;
  if (intent === "create_customer") return `/highlevel/customers?new=1&prompt=${encoded}`;
  if (intent === "review_leads") return "/highlevel/leads";
  if (intent === "find_customer") return "/highlevel/customers";
  if (intent === "review_jobs" || intent === "add_time" || intent === "add_material" || intent === "update_job") return "/highlevel/jobs";
  if (intent === "review_money" || intent === "follow_up_invoice") return "/highlevel/money";
  return "/highlevel/home";
}

export function avaIntentLabel(intent: AvaIntent) {
  const labels: Record<AvaIntent, string> = {
    create_estimate: "Build estimate",
    create_job: "Create job",
    create_lead: "Add lead",
    create_customer: "Add customer",
    review_leads: "Review leads",
    review_jobs: "Review jobs",
    review_money: "Review money",
    find_customer: "Find customer",
    add_time: "Add labor",
    add_material: "Add material",
    update_job: "Update job",
    follow_up_invoice: "Draft payment follow-up",
    other: "Review request",
  };
  return labels[intent];
}

export function avaIntentRequiresApproval(intent: AvaIntent) {
  return [
    "create_estimate",
    "create_job",
    "create_lead",
    "create_customer",
    "add_time",
    "add_material",
    "update_job",
    "follow_up_invoice",
  ].includes(intent);
}

function defaultNextStep(intent: AvaIntent) {
  const steps: Record<AvaIntent, string> = {
    create_estimate: "Open the estimate builder, let Ava organize the scope, then review every quantity and price before saving.",
    create_job: "Open a new job draft, verify the customer, address, scope, status, and start date, then save it.",
    create_lead: "Open a new lead draft, verify the contact information and request, then save it to the FastTract pipeline.",
    create_customer: "Open a new customer draft, verify the contact details, then save it to HighLevel.",
    review_leads: "Open Leads and work from Qualified and New down through the follow-up queue.",
    review_jobs: "Open Jobs and review active, on-hold, and upcoming work in priority order.",
    review_money: "Open Money and work through overdue balances, draft invoices, and accepted estimates.",
    find_customer: "Open Customers and search by name, phone, email, or address.",
    add_time: "Open the correct job, choose Add time, verify the worker, date, hours, and labor cost, then save.",
    add_material: "Open the correct job, choose Add material, verify the quantity and unit cost, then save.",
    update_job: "Open the correct job, review the requested change, then update its details or status.",
    follow_up_invoice: "Review the draft message below, make any changes, then return to Money before sending anything.",
    other: "Review the request and choose the FastTract workspace that should handle it.",
  };
  return steps[intent];
}

function sanitizeMissingInformation(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim())
    .slice(0, 8);
}

export function normalizeAvaPlan(prompt: string, draft: AvaDraftResult = {}): AvaPlan {
  const inferredIntent = inferAvaIntent(prompt);
  const modelIntent = draft.intent && intents.includes(draft.intent) ? draft.intent : "other";
  const intent = inferredIntent !== "other" ? inferredIntent : modelIntent;

  return {
    intent,
    summary: draft.summary?.trim() || `Ava understood: ${prompt.trim()}`,
    nextStep: draft.next_step?.trim() || defaultNextStep(intent),
    draftContent: draft.draft_content?.trim() || "",
    missingInformation: sanitizeMissingInformation(draft.missing_information),
    requiresApproval: Boolean(draft.requires_approval) || avaIntentRequiresApproval(intent),
    actionLabel: avaIntentLabel(intent),
    route: routeForAvaIntent(intent, prompt),
  };
}

export function buildAvaBusinessSnapshot(input: SnapshotInput): AvaBusinessSnapshot {
  const dashboard = buildHighLevelDashboard(input);
  const money = summarizeMoney(input.estimates, input.invoices, input.now);

  return {
    openLeads: dashboard.metrics.openLeads,
    qualifiedLeads: dashboard.metrics.hotLeads,
    activeJobs: dashboard.metrics.activeJobs,
    draftEstimates: dashboard.metrics.draftEstimates,
    waitingEstimates: dashboard.metrics.waitingEstimates,
    acceptedEstimateValue: dashboard.metrics.readyToInvoiceValue,
    draftInvoiceValue: money.draftValue,
    outstandingInvoiceValue: money.outstandingValue,
    overdueInvoiceValue: money.overdueValue,
    topPriority: dashboard.now[0]?.title || dashboard.next[0]?.title || dashboard.later[0]?.title || null,
  };
}

export function avaSuggestions(snapshot: AvaBusinessSnapshot) {
  const suggestions: string[] = [];
  const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  if (snapshot.overdueInvoiceValue > 0) suggestions.push(`Help me collect the ${format.format(snapshot.overdueInvoiceValue)} that is overdue`);
  if (snapshot.qualifiedLeads > 0) suggestions.push(`Show me the ${snapshot.qualifiedLeads} qualified lead${snapshot.qualifiedLeads === 1 ? "" : "s"} that should move next`);
  if (snapshot.acceptedEstimateValue > 0) suggestions.push(`Turn accepted work worth ${format.format(snapshot.acceptedEstimateValue)} into invoices`);
  if (snapshot.draftEstimates > 0) suggestions.push(`Help me finish the ${snapshot.draftEstimates} draft estimate${snapshot.draftEstimates === 1 ? "" : "s"}`);

  suggestions.push(
    "Build an estimate for a 30 by 20 stamped concrete patio with removal",
    "Create a job for the Fletcher driveway next Monday",
    "Add a new lead from a customer phone call",
    "Show me what needs my attention today",
  );

  return [...new Set(suggestions)].slice(0, 4);
}
