import type { HighLevelRecord } from "@/integrations/highlevel/client";
import type { AvaIntent, AvaPlan } from "./highlevelAva";

export type FastTractApprovalStatus = "pending" | "in_review" | "completed" | "rejected";
export type FastTractApprovalRisk = "review" | "record_change" | "communication" | "financial";

export type ApprovalAuthor = {
  userId?: string | null;
  name?: string | null;
};

export type ApprovalRecordInput = {
  plan: AvaPlan;
  sourcePrompt: string;
  author?: ApprovalAuthor;
  targetRecordType?: string | null;
  targetRecordId?: string | null;
};

export type ApprovalSummary = {
  pending: number;
  inReview: number;
  completed: number;
  rejected: number;
  financial: number;
  communication: number;
};

const statusValues: FastTractApprovalStatus[] = ["pending", "in_review", "completed", "rejected"];
const riskValues: FastTractApprovalRisk[] = ["review", "record_change", "communication", "financial"];

export const approvalPropertyKeys = {
  name: keys("approval_name"),
  status: keys("status"),
  intent: keys("intent"),
  risk: keys("risk_level"),
  summary: keys("summary"),
  nextStep: keys("next_step"),
  draftContent: keys("draft_content"),
  missingInformation: keys("missing_information"),
  route: keys("route"),
  sourcePrompt: keys("source_prompt"),
  createdByUserId: keys("created_by_user_id"),
  createdByName: keys("created_by_name"),
  reviewedByUserId: keys("reviewed_by_user_id"),
  reviewedByName: keys("reviewed_by_name"),
  reviewedDate: keys("reviewed_date"),
  completedDate: keys("completed_date"),
  targetRecordType: keys("target_record_type"),
  targetRecordId: keys("target_record_id"),
  notes: keys("notes"),
};

function keys(name: string) {
  return [
    `custom_objects.approval_actions.${name}`,
    `custom_object.approval_actions.${name}`,
    name,
  ];
}

export function readApprovalString(record: HighLevelRecord, propertyKeys: string[]) {
  const properties = record.properties ?? {};
  for (const key of propertyKeys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function approvalName(record: HighLevelRecord) {
  return readApprovalString(record, approvalPropertyKeys.name)
    || readApprovalString(record, approvalPropertyKeys.summary)
    || "Ava prepared action";
}

export function approvalStatus(record: HighLevelRecord): FastTractApprovalStatus {
  const value = readApprovalString(record, approvalPropertyKeys.status).toLowerCase();
  return statusValues.includes(value as FastTractApprovalStatus)
    ? value as FastTractApprovalStatus
    : "pending";
}

export function approvalRisk(record: HighLevelRecord): FastTractApprovalRisk {
  const value = readApprovalString(record, approvalPropertyKeys.risk).toLowerCase();
  return riskValues.includes(value as FastTractApprovalRisk)
    ? value as FastTractApprovalRisk
    : "review";
}

export function approvalIntent(record: HighLevelRecord): AvaIntent | "other" {
  return (readApprovalString(record, approvalPropertyKeys.intent) || "other") as AvaIntent | "other";
}

export function riskForAvaIntent(intent: AvaIntent): FastTractApprovalRisk {
  if (["send_estimate", "send_invoice", "record_payment", "create_change_order", "create_estimate"].includes(intent)) {
    return "financial";
  }
  if (["follow_up_invoice", "follow_up_lead"].includes(intent)) return "communication";
  if ([
    "create_job",
    "create_lead",
    "create_customer",
    "add_time",
    "add_material",
    "update_job",
  ].includes(intent)) return "record_change";
  return "review";
}

const safeRoutes = [
  "/highlevel/home",
  "/highlevel/leads",
  "/highlevel/customers",
  "/highlevel/jobs",
  "/highlevel/money",
  "/highlevel/estimates",
  "/highlevel/ai",
  "/highlevel/approvals",
] as const;

export function safeApprovalRoute(value: string | null | undefined) {
  const route = typeof value === "string" ? value.trim() : "";
  if (!route.startsWith("/highlevel/") || route.startsWith("//")) return "/highlevel/ai";
  const [pathname] = route.split(/[?#]/, 1);
  if (!safeRoutes.includes(pathname as typeof safeRoutes[number])) return "/highlevel/ai";
  return route;
}

function truncate(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function missingInformationJson(items: string[]) {
  return JSON.stringify(items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12));
}

export function approvalRecordPayload(input: ApprovalRecordInput) {
  const { plan, sourcePrompt, author, targetRecordId, targetRecordType } = input;
  const risk = riskForAvaIntent(plan.intent);
  const shortSummary = truncate(plan.summary, 180) || "Ava prepared action";

  return {
    properties: {
      approval_name: shortSummary,
      status: "pending",
      intent: plan.intent,
      risk_level: risk,
      summary: truncate(plan.summary, 4000),
      next_step: truncate(plan.nextStep, 4000),
      draft_content: truncate(plan.draftContent, 12000) || null,
      missing_information: missingInformationJson(plan.missingInformation),
      route: safeApprovalRoute(plan.route),
      source_prompt: truncate(sourcePrompt, 12000),
      created_by_user_id: truncate(author?.userId ?? "", 160) || null,
      created_by_name: truncate(author?.name ?? "", 240) || null,
      reviewed_by_user_id: null,
      reviewed_by_name: null,
      reviewed_date: null,
      completed_date: null,
      target_record_type: truncate(targetRecordType ?? "", 120) || null,
      target_record_id: truncate(targetRecordId ?? "", 180) || null,
      notes: null,
    },
  };
}

export function approvalMissingInformation(record: HighLevelRecord) {
  const raw = readApprovalString(record, approvalPropertyKeys.missingInformation);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim())
      .slice(0, 12);
  } catch {
    return raw.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 12);
  }
}

export function approvalStatusLabel(status: FastTractApprovalStatus) {
  const labels: Record<FastTractApprovalStatus, string> = {
    pending: "Waiting for review",
    in_review: "In review",
    completed: "Completed",
    rejected: "Rejected",
  };
  return labels[status];
}

export function approvalRiskLabel(risk: FastTractApprovalRisk) {
  const labels: Record<FastTractApprovalRisk, string> = {
    review: "Review only",
    record_change: "Business record",
    communication: "Customer message",
    financial: "Financial action",
  };
  return labels[risk];
}

function recordTimestamp(record: HighLevelRecord) {
  const value = record.updatedAt || record.dateUpdated || record.createdAt || record.dateAdded || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const statusOrder: Record<FastTractApprovalStatus, number> = {
  pending: 0,
  in_review: 1,
  completed: 2,
  rejected: 3,
};

export function sortApprovals(records: HighLevelRecord[]) {
  return [...records].sort((a, b) => {
    const statusDifference = statusOrder[approvalStatus(a)] - statusOrder[approvalStatus(b)];
    if (statusDifference !== 0) return statusDifference;
    return recordTimestamp(b) - recordTimestamp(a);
  });
}

export function summarizeApprovals(records: HighLevelRecord[]): ApprovalSummary {
  const summary: ApprovalSummary = {
    pending: 0,
    inReview: 0,
    completed: 0,
    rejected: 0,
    financial: 0,
    communication: 0,
  };

  for (const record of records) {
    const status = approvalStatus(record);
    if (status === "pending") summary.pending += 1;
    if (status === "in_review") summary.inReview += 1;
    if (status === "completed") summary.completed += 1;
    if (status === "rejected") summary.rejected += 1;

    if (["pending", "in_review"].includes(status)) {
      const risk = approvalRisk(record);
      if (risk === "financial") summary.financial += 1;
      if (risk === "communication") summary.communication += 1;
    }
  }

  return summary;
}
