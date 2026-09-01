import { describe, expect, it } from "vitest";
import type { HighLevelRecord } from "@/integrations/highlevel/client";
import type { AvaPlan } from "./highlevelAva";
import {
  approvalMissingInformation,
  approvalRecordPayload,
  approvalRisk,
  approvalStatus,
  riskForAvaIntent,
  safeApprovalRoute,
  sortApprovals,
  summarizeApprovals,
} from "./highlevelApprovals";

function record(id: string, properties: Record<string, unknown>, updatedAt = "2026-09-01T12:00:00Z"): HighLevelRecord {
  return { id, properties, updatedAt };
}

function plan(overrides: Partial<AvaPlan> = {}): AvaPlan {
  return {
    intent: "create_estimate",
    summary: "Prepare the Fletcher patio estimate",
    nextStep: "Review every line item before saving.",
    draftContent: "",
    missingInformation: ["Verified concrete price"],
    requiresApproval: true,
    actionLabel: "Build estimate",
    route: "/highlevel/estimates?prompt=Fletcher",
    ...overrides,
  };
}

describe("FastTract approval center", () => {
  it("allows only internal FastTract review routes", () => {
    expect(safeApprovalRoute("/highlevel/jobs?open=job-1")).toBe("/highlevel/jobs?open=job-1");
    expect(safeApprovalRoute("https://malicious.example/steal")).toBe("/highlevel/ai");
    expect(safeApprovalRoute("/highlevel/not-a-real-workspace")).toBe("/highlevel/ai");
    expect(safeApprovalRoute("//malicious.example")).toBe("/highlevel/ai");
  });

  it("creates a pending audit record without claiming the action happened", () => {
    const payload = approvalRecordPayload({
      plan: plan(),
      sourcePrompt: "Build the Fletcher patio estimate",
      author: { userId: "user-1", name: "Morgan" },
    });

    expect(payload.properties).toMatchObject({
      status: "pending",
      intent: "create_estimate",
      risk_level: "financial",
      created_by_user_id: "user-1",
      created_by_name: "Morgan",
      route: "/highlevel/estimates?prompt=Fletcher",
    });
    expect(payload.properties.missing_information).toBe('["Verified concrete price"]');
    expect(payload.properties.completed_date).toBeNull();
  });

  it("maps sensitive Ava intents to the correct review risk", () => {
    expect(riskForAvaIntent("record_payment")).toBe("financial");
    expect(riskForAvaIntent("send_invoice")).toBe("financial");
    expect(riskForAvaIntent("follow_up_invoice")).toBe("communication");
    expect(riskForAvaIntent("create_job")).toBe("record_change");
    expect(riskForAvaIntent("review_jobs")).toBe("review");
  });

  it("reads prefixed HighLevel properties and safely parses missing information", () => {
    const item = record("approval-1", {
      "custom_object.approval_actions.status": "in_review",
      "custom_objects.approval_actions.risk_level": "communication",
      missing_information: '["Customer email","Payment link"]',
    });

    expect(approvalStatus(item)).toBe("in_review");
    expect(approvalRisk(item)).toBe("communication");
    expect(approvalMissingInformation(item)).toEqual(["Customer email", "Payment link"]);
  });

  it("orders open work first and summarizes the review queue", () => {
    const records = [
      record("completed", { status: "completed", risk_level: "financial" }, "2026-09-01T15:00:00Z"),
      record("pending-old", { status: "pending", risk_level: "communication" }, "2026-09-01T10:00:00Z"),
      record("review", { status: "in_review", risk_level: "financial" }, "2026-09-01T13:00:00Z"),
      record("pending-new", { status: "pending", risk_level: "financial" }, "2026-09-01T14:00:00Z"),
      record("rejected", { status: "rejected", risk_level: "review" }, "2026-09-01T16:00:00Z"),
    ];

    expect(sortApprovals(records).map((item) => item.id)).toEqual([
      "pending-new",
      "pending-old",
      "review",
      "completed",
      "rejected",
    ]);
    expect(summarizeApprovals(records)).toEqual({
      pending: 2,
      inReview: 1,
      completed: 1,
      rejected: 1,
      financial: 2,
      communication: 1,
    });
  });
});
