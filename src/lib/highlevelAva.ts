import type {
  FastTractLead,
  HighLevelEstimate,
  HighLevelInvoice,
  HighLevelRecord,
} from "@/integrations/highlevel/client";
import { buildHighLevelDashboard } from "./highlevelDashboard";
import { summarizeMoney } from "./highlevelMoney";

export const avaIntentValues = [
  "create_estimate",
  "send_estimate",
  "create_job",
  "create_lead",
  "create_customer",
  "create_change_order",
  "review_leads",
  "review_jobs",
  "review_money",
  "find_customer",
  "add_time",
  "add_material",
  "update_job",
  "convert_estimate",
  "send_invoice",
  "record_payment",
  "follow_up_invoice",
  "other",
] as const;

export type AvaIntent = (typeof avaIntentValues)[number];

export const avaRiskValues = [
  "review",
  "record_change",
  "customer_communication",
  "financial",
] as const;

export type AvaRiskLevel = (typeof avaRiskValues)[number];

export type AvaProposedChange = {
  label: string;
  value: string;
};

export type AvaDraftResult = {
  intent?: AvaIntent;
  summary?: string;
  next_step?: string;
  draft_content?: string;
  missing_information?: unknown;
  requires_approval?: boolean;
  action_title?: string;
  target_label?: string;
  proposed_changes?: unknown;
  approval_reason?: string;
  risk_level?: AvaRiskLevel;
};

export type AvaPlan = {
  intent: AvaIntent;
  sourcePrompt: string;
  summary: string;
  nextStep: string;
  draftContent: string;
  missingInformation: string[];
  requiresApproval: boolean;
  actionLabel: string;
  actionTitle: string;
  targetLabel: string;
  proposedChanges: AvaProposedChange[];
  approvalReason: string;
  riskLevel: AvaRiskLevel;
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

const riskRank: Record<AvaRiskLevel, number> = {
  review: 0,
  record_change: 1,
  customer_communication: 2,
  financial: 3,
};

function hasAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function inferAvaIntent(prompt: string): AvaIntent {
  const value = prompt.trim().toLowerCase();
  if (!value) return "other";

  if (hasAny(value, [
    /\b(create|add|draft|prepare|price|write)\b.*\b(change order|scope change|extra work)\b/,
    /\b(change order|scope change|extra work)\b.*\b(job|customer|price|amount|approval)\b/,
  ])) return "create_change_order";

  if (hasAny(value, [
    /\b(payment reminder|invoice reminder|past due|overdue|collect|collection|chase payment|follow up on (?:an )?invoice)\b/,
    /\bremind\b.*\b(pay|payment|invoice|balance)\b/,
  ])) return "follow_up_invoice";

  if (hasAny(value, [
    /\b(record|log|enter|apply)\b.*\b(payment|deposit)\b/,
    /\b(received|paid)\b.*\b(cash|card|check|cheque|bank transfer|deposit)\b/,
    /\b(payment|deposit)\b.*\b(cash|card|check|cheque|bank transfer)\b/,
  ])) return "record_payment";

  if (hasAny(value, [
    /\b(send|email|text|deliver)\b.*\b(estimate|bid|quote|proposal)\b/,
  ])) return "send_estimate";

  if (hasAny(value, [
    /\b(convert|turn|make|create)\b.*\b(accepted estimate|approved estimate|accepted work|estimate)\b.*\binvoices?\b/,
    /\b(create|make)\b.*\binvoices?\b/,
  ])) return "convert_estimate";

  if (hasAny(value, [
    /\b(send|email|text|deliver)\b.*\binvoices?\b/,
  ])) return "send_invoice";

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
    /\b(money|cash|cashflow|revenue|receivables?|invoices?|paid|unpaid|outstanding|billing|change orders?)\b/,
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
  if (intent === "create_change_order") return "/highlevel/money?view=action";
  if (intent === "review_leads") return "/highlevel/leads";
  if (intent === "find_customer") return "/highlevel/customers";
  if (intent === "review_jobs" || intent === "add_time" || intent === "add_material" || intent === "update_job") return "/highlevel/jobs";
  if (
    intent === "review_money"
    || intent === "convert_estimate"
    || intent === "send_invoice"
    || intent === "record_payment"
    || intent === "follow_up_invoice"
  ) return "/highlevel/money";
  if (intent === "send_estimate") return "/highlevel/estimates";
  return "/highlevel/home";
}

export function avaIntentLabel(intent: AvaIntent) {
  const labels: Record<AvaIntent, string> = {
    create_estimate: "Build estimate",
    send_estimate: "Review estimate delivery",
    create_job: "Create job",
    create_lead: "Add lead",
    create_customer: "Add customer",
    create_change_order: "Create change order",
    review_leads: "Review leads",
    review_jobs: "Review jobs",
    review_money: "Review money",
    find_customer: "Find customer",
    add_time: "Add labor",
    add_material: "Add material",
    update_job: "Update job",
    convert_estimate: "Review invoice creation",
    send_invoice: "Review invoice delivery",
    record_payment: "Review payment",
    follow_up_invoice: "Draft payment follow-up",
    other: "Review request",
  };
  return labels[intent];
}

export function avaIntentRequiresApproval(intent: AvaIntent) {
  return [
    "create_estimate",
    "send_estimate",
    "create_job",
    "create_lead",
    "create_customer",
    "create_change_order",
    "add_time",
    "add_material",
    "update_job",
    "convert_estimate",
    "send_invoice",
    "record_payment",
    "follow_up_invoice",
  ].includes(intent);
}

export function riskForAvaIntent(intent: AvaIntent): AvaRiskLevel {
  if (["create_estimate", "create_change_order", "convert_estimate", "record_payment"].includes(intent)) return "financial";
  if (["send_estimate", "send_invoice", "follow_up_invoice"].includes(intent)) return "customer_communication";
  if (["create_job", "create_lead", "create_customer", "add_time", "add_material", "update_job"].includes(intent)) return "record_change";
  return "review";
}

function defaultNextStep(intent: AvaIntent) {
  const steps: Record<AvaIntent, string> = {
    create_estimate: "Open the estimate builder, let Ava organize the scope, then review every quantity and price before saving.",
    send_estimate: "Open Estimates, verify the customer, scope, price, terms, and delivery channel, then send it yourself.",
    create_job: "Open a new job draft, verify the customer, address, scope, status, and start date, then save it.",
    create_lead: "Open a new lead draft, verify the contact information and request, then save it to the FastTract pipeline.",
    create_customer: "Open a new customer draft, verify the contact details, then save it to HighLevel.",
    create_change_order: "Open Money, choose the correct job, verify the changed scope, amount, tax, and requested date, then save the draft.",
    review_leads: "Open Leads and work from Qualified and New down through the follow-up queue.",
    review_jobs: "Open Jobs and review active, on-hold, and upcoming work in priority order.",
    review_money: "Open Money and work through overdue balances, draft invoices, accepted estimates, and change orders.",
    find_customer: "Open Customers and search by name, phone, email, or address.",
    add_time: "Open the correct job, choose Add time, verify the worker, date, hours, and labor cost, then save.",
    add_material: "Open the correct job, choose Add material, verify the quantity and unit cost, then save.",
    update_job: "Open the correct job, review the requested change, then update its details or status.",
    convert_estimate: "Open Money, confirm the accepted estimate is linked to the correct job and customer, then create the native invoice.",
    send_invoice: "Open Money, verify the invoice, balance, customer, and delivery channel, then send it yourself.",
    record_payment: "Open Money, choose the exact invoice, verify the amount, date, and method, then record the payment.",
    follow_up_invoice: "Review the draft message below, make any changes, then return to Money before sending anything.",
    other: "Review the request and choose the FastTract workspace that should handle it.",
  };
  return steps[intent];
}

function defaultActionTitle(intent: AvaIntent) {
  const titles: Record<AvaIntent, string> = {
    create_estimate: "Prepare a customer estimate",
    send_estimate: "Send an estimate",
    create_job: "Create a new job",
    create_lead: "Add a new lead",
    create_customer: "Add a new customer",
    create_change_order: "Prepare a change order",
    review_leads: "Review the lead queue",
    review_jobs: "Review the job queue",
    review_money: "Review the money queue",
    find_customer: "Find a customer",
    add_time: "Record crew time",
    add_material: "Record job materials",
    update_job: "Update a job",
    convert_estimate: "Create an invoice from accepted work",
    send_invoice: "Send an invoice",
    record_payment: "Record an invoice payment",
    follow_up_invoice: "Prepare a payment follow-up",
    other: "Review the business request",
  };
  return titles[intent];
}

function defaultApprovalReason(risk: AvaRiskLevel) {
  if (risk === "financial") return "This action can change customer pricing, billing, or recorded money and requires human review.";
  if (risk === "customer_communication") return "This action can send customer-facing communication and requires a final human review.";
  if (risk === "record_change") return "This action can create or change business records and requires confirmation before saving.";
  return "This is a review-only request and does not change business data.";
}

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeMissingInformation(value: unknown) {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim().slice(0, 240))
    .slice(0, 8);
}

function cleanText(value: unknown, max = 500) {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" && Number.isFinite(value)) return String(value).slice(0, max);
  if (typeof value === "boolean") return String(value);
  return "";
}

export function sanitizeAvaProposedChanges(value: unknown): AvaProposedChange[] {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];

  const forbiddenLabel = /\b(access token|refresh token|secret|password|route|url|record id|location id|company id|user id)\b/i;
  const changes: AvaProposedChange[] = [];

  for (const item of parsed) {
    if (changes.length >= 10) break;

    if (typeof item === "string") {
      const valueText = cleanText(item, 500);
      if (valueText) changes.push({ label: "Proposed detail", value: valueText });
      continue;
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const label = cleanText(record.label ?? record.field ?? record.name, 120);
    const valueText = cleanText(record.value ?? record.proposed_value ?? record.detail, 500);
    if (!label || !valueText || forbiddenLabel.test(label)) continue;
    changes.push({ label, value: valueText });
  }

  return changes;
}

function normalizedRisk(intent: AvaIntent, modelRisk: unknown): AvaRiskLevel {
  const baseline = riskForAvaIntent(intent);
  const candidate = typeof modelRisk === "string" && avaRiskValues.includes(modelRisk as AvaRiskLevel)
    ? modelRisk as AvaRiskLevel
    : "review";
  return riskRank[candidate] > riskRank[baseline] ? candidate : baseline;
}

export function normalizeAvaPlan(prompt: string, draft: AvaDraftResult = {}): AvaPlan {
  const sourcePrompt = prompt.trim();
  const inferredIntent = inferAvaIntent(sourcePrompt);
  const modelIntent = draft.intent && avaIntentValues.includes(draft.intent) ? draft.intent : "other";
  const intent = inferredIntent !== "other" ? inferredIntent : modelIntent;
  const riskLevel = normalizedRisk(intent, draft.risk_level);

  return {
    intent,
    sourcePrompt,
    summary: draft.summary?.trim().slice(0, 1200) || `Ava understood: ${sourcePrompt}`,
    nextStep: draft.next_step?.trim().slice(0, 1200) || defaultNextStep(intent),
    draftContent: draft.draft_content?.trim().slice(0, 5000) || "",
    missingInformation: sanitizeMissingInformation(draft.missing_information),
    requiresApproval: Boolean(draft.requires_approval) || avaIntentRequiresApproval(intent),
    actionLabel: avaIntentLabel(intent),
    actionTitle: draft.action_title?.trim().slice(0, 180) || defaultActionTitle(intent),
    targetLabel: draft.target_label?.trim().slice(0, 180) || "",
    proposedChanges: sanitizeAvaProposedChanges(draft.proposed_changes),
    approvalReason: draft.approval_reason?.trim().slice(0, 600) || defaultApprovalReason(riskLevel),
    riskLevel,
    route: routeForAvaIntent(intent, sourcePrompt),
  };
}

export function buildAvaBusinessSnapshot(input: SnapshotInput): AvaBusinessSnapshot {
  const dashboard = buildHighLevelDashboard(input);
  const moneySummary = summarizeMoney(input.estimates, input.invoices, input.now);

  return {
    openLeads: dashboard.metrics.openLeads,
    qualifiedLeads: dashboard.metrics.hotLeads,
    activeJobs: dashboard.metrics.activeJobs,
    draftEstimates: dashboard.metrics.draftEstimates,
    waitingEstimates: dashboard.metrics.waitingEstimates,
    acceptedEstimateValue: dashboard.metrics.readyToInvoiceValue,
    draftInvoiceValue: moneySummary.draftValue,
    outstandingInvoiceValue: moneySummary.outstandingValue,
    overdueInvoiceValue: moneySummary.overdueValue,
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
