import type { HighLevelRecord } from "@/integrations/highlevel/client";
import {
  avaIntentValues,
  avaRiskValues,
  riskForAvaIntent,
  routeForAvaIntent,
  sanitizeAvaProposedChanges,
  type AvaIntent,
  type AvaPlan,
  type AvaProposedChange,
  type AvaRiskLevel,
} from "@/lib/highlevelAva";

export const avaApprovalStatusValues = [
  "draft",
  "approved",
  "completed",
  "dismissed",
] as const;

export type AvaApprovalStatus = (typeof avaApprovalStatusValues)[number];

export type AvaApprovalAction = {
  id: string;
  actionTitle: string;
  actionType: AvaIntent;
  status: AvaApprovalStatus;
  riskLevel: AvaRiskLevel;
  sourcePrompt: string;
  summary: string;
  nextStep: string;
  draftContent: string;
  targetLabel: string;
  proposedChanges: AvaProposedChange[];
  missingInformation: string[];
  requiresApproval: boolean;
  requestedBy: string;
  requestedDate: string;
  approvedBy: string;
  approvedDate: string;
  completedBy: string;
  completedDate: string;
  dismissedBy: string;
  dismissedDate: string;
  createdAt: string;
  updatedAt: string;
  route: string;
};

const statusOrder: Record<AvaApprovalStatus, number> = {
  draft: 0,
  approved: 1,
  completed: 2,
  dismissed: 3,
};

function propertyKeys(key: string) {
  // FastTract APIs normalize current values to bare keys. Prefer those
  // when HighLevel also returns an older namespaced representation.
  return [
    key,
    `custom_objects.ava_actions.${key}`,
    `custom_object.ava_actions.${key}`,
  ];
}

function readString(record: HighLevelRecord, key: string) {
  const properties = record.properties ?? {};
  for (const candidate of propertyKeys(key)) {
    const value = properties[candidate];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
  }
  return "";
}

function parseJsonArray(value: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMissingInformation(value: string) {
  return parseJsonArray(value)
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim().slice(0, 240))
    .slice(0, 8);
}

function normalizedIntent(value: string): AvaIntent {
  return avaIntentValues.includes(value as AvaIntent) ? value as AvaIntent : "other";
}

function normalizedStatus(value: string): AvaApprovalStatus {
  return avaApprovalStatusValues.includes(value as AvaApprovalStatus)
    ? value as AvaApprovalStatus
    : "draft";
}

function normalizedRisk(value: string, intent: AvaIntent): AvaRiskLevel {
  return avaRiskValues.includes(value as AvaRiskLevel)
    ? value as AvaRiskLevel
    : riskForAvaIntent(intent);
}

function asTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function approvalFromRecord(record: HighLevelRecord): AvaApprovalAction {
  const actionType = normalizedIntent(readString(record, "action_type"));
  const status = normalizedStatus(readString(record, "status"));
  const sourcePrompt = readString(record, "source_prompt");
  const createdAt = record.createdAt || record.dateAdded || readString(record, "requested_date");
  const updatedAt = record.updatedAt || record.dateUpdated || createdAt;

  return {
    id: record.id,
    actionTitle: readString(record, "action_title") || "Ava approval",
    actionType,
    status,
    riskLevel: normalizedRisk(readString(record, "risk_level"), actionType),
    sourcePrompt,
    summary: readString(record, "summary"),
    nextStep: readString(record, "next_step"),
    draftContent: readString(record, "draft_content"),
    targetLabel: readString(record, "target_label"),
    proposedChanges: sanitizeAvaProposedChanges(readString(record, "proposed_changes")),
    missingInformation: parseMissingInformation(readString(record, "missing_information")),
    requiresApproval: readString(record, "requires_approval") !== "false",
    requestedBy: readString(record, "requested_by"),
    requestedDate: readString(record, "requested_date"),
    approvedBy: readString(record, "approved_by"),
    approvedDate: readString(record, "approved_date"),
    completedBy: readString(record, "completed_by"),
    completedDate: readString(record, "completed_date"),
    dismissedBy: readString(record, "dismissed_by"),
    dismissedDate: readString(record, "dismissed_date"),
    createdAt,
    updatedAt,
    route: routeForAvaIntent(actionType, sourcePrompt),
  };
}

export function sortApprovals(records: HighLevelRecord[]) {
  return records
    .map(approvalFromRecord)
    .sort((a, b) => (
      statusOrder[a.status] - statusOrder[b.status]
      || asTimestamp(b.updatedAt || b.requestedDate) - asTimestamp(a.updatedAt || a.requestedDate)
      || a.actionTitle.localeCompare(b.actionTitle)
    ));
}

export function approvalPayload(plan: AvaPlan) {
  return {
    properties: {
      action_title: plan.actionTitle,
      action_type: plan.intent,
      status: "draft",
      risk_level: plan.riskLevel,
      source_prompt: plan.sourcePrompt,
      summary: plan.summary,
      next_step: plan.nextStep,
      draft_content: plan.draftContent || null,
      target_label: plan.targetLabel || null,
      proposed_changes: JSON.stringify(plan.proposedChanges),
      missing_information: JSON.stringify(plan.missingInformation),
      requires_approval: plan.requiresApproval ? "true" : "false",
    },
  };
}

const allowedTransitions: Record<AvaApprovalStatus, AvaApprovalStatus[]> = {
  draft: ["approved", "dismissed"],
  approved: ["completed", "dismissed"],
  completed: [],
  dismissed: [],
};

export function canApprove(action: AvaApprovalAction) {
  return action.status === "draft" && action.missingInformation.length === 0;
}

export function statusUpdatePayload(
  action: AvaApprovalAction,
  nextStatus: AvaApprovalStatus,
) {
  if (!allowedTransitions[action.status].includes(nextStatus)) {
    throw new Error(`Ava approval cannot move from ${action.status} to ${nextStatus}`);
  }
  if (nextStatus === "approved" && action.missingInformation.length > 0) {
    throw new Error("Resolve the missing information before approving this action");
  }

  return { properties: { status: nextStatus } };
}

export function approvalStatusLabel(status: AvaApprovalStatus) {
  const labels: Record<AvaApprovalStatus, string> = {
    draft: "Waiting for approval",
    approved: "Approved for final review",
    completed: "Handled",
    dismissed: "Dismissed",
  };
  return labels[status];
}

export function approvalRiskLabel(risk: AvaRiskLevel) {
  const labels: Record<AvaRiskLevel, string> = {
    review: "Review only",
    record_change: "Business record",
    customer_communication: "Customer communication",
    financial: "Financial action",
  };
  return labels[risk];
}

export function isDuplicateApproval(actions: AvaApprovalAction[], plan: AvaPlan) {
  return actions.some((action) => (
    ["draft", "approved"].includes(action.status)
    && action.actionType === plan.intent
    && action.sourcePrompt.trim().toLowerCase() === plan.sourcePrompt.trim().toLowerCase()
  ));
}
