import { describe, expect, it } from "vitest";
import type { HighLevelRecord } from "@/integrations/highlevel/client";
import { normalizeAvaPlan } from "@/lib/highlevelAva";
import {
  approvalFromRecord,
  approvalPayload,
  canApprove,
  isDuplicateApproval,
  sortApprovals,
  statusUpdatePayload,
} from "./avaApprovalModel";

function record(overrides: Partial<HighLevelRecord> = {}): HighLevelRecord {
  return {
    id: "approval-1",
    createdAt: "2026-09-01T12:00:00Z",
    properties: {
      "custom_objects.ava_actions.action_title": "Create Fletcher patio job",
      "custom_object.ava_actions.action_type": "create_job",
      "custom_objects.ava_actions.status": "draft",
      "custom_object.ava_actions.risk_level": "record_change",
      "custom_objects.ava_actions.source_prompt": "Create a job for Fletcher next Monday",
      "custom_object.ava_actions.summary": "A new job draft is ready for review.",
      "custom_objects.ava_actions.next_step": "Verify the customer and schedule.",
      "custom_object.ava_actions.proposed_changes": JSON.stringify([
        { label: "Job name", value: "Fletcher patio" },
      ]),
      "custom_objects.ava_actions.missing_information": "[]",
      "custom_object.ava_actions.requires_approval": "true",
      "custom_objects.ava_actions.requested_by": "Morgan",
      "custom_object.ava_actions.requested_date": "2026-09-01",
    },
    ...overrides,
  };
}

describe("Ava approval model", () => {
  it("normalizes a location-owned HighLevel approval record and derives a safe route", () => {
    const action = approvalFromRecord(record());

    expect(action).toMatchObject({
      id: "approval-1",
      actionType: "create_job",
      status: "draft",
      riskLevel: "record_change",
      requestedBy: "Morgan",
    });
    expect(action.proposedChanges).toEqual([{ label: "Job name", value: "Fletcher patio" }]);
    expect(decodeURIComponent(action.route)).toContain("Create a job for Fletcher next Monday");
    expect(action.route).toContain("/highlevel/jobs?new=1");
    expect(canApprove(action)).toBe(true);
  });

  it("builds a draft payload without executable routes or client-selected audit fields", () => {
    const plan = normalizeAvaPlan("Record a $500 cash payment for invoice 1042", {
      action_title: "Record customer payment",
      target_label: "Invoice 1042",
      proposed_changes: [
        { label: "Amount", value: "$500" },
        { label: "Method", value: "Cash" },
      ],
      approval_reason: "Payment changes the customer balance.",
    });

    const payload = approvalPayload(plan);
    expect(payload.properties).toMatchObject({
      action_type: "record_payment",
      status: "draft",
      risk_level: "financial",
      target_label: "Invoice 1042",
      requires_approval: "true",
    });
    expect(payload.properties).not.toHaveProperty("route");
    expect(payload.properties).not.toHaveProperty("record_id");
    expect(payload.properties).not.toHaveProperty("requested_by");
    expect(payload.properties).not.toHaveProperty("approved_by");
    expect(payload.properties.proposed_changes).toContain("$500");
  });

  it("blocks approval while important information is missing", () => {
    const action = approvalFromRecord(record({
      properties: {
        action_title: "Prepare an estimate",
        action_type: "create_estimate",
        status: "draft",
        risk_level: "financial",
        source_prompt: "Estimate the patio",
        summary: "Estimate draft",
        next_step: "Review it",
        proposed_changes: "[]",
        missing_information: JSON.stringify(["Verified dimensions", "Customer"]),
        requires_approval: "true",
        requested_by: "Morgan",
        requested_date: "2026-09-01",
      },
    }));

    expect(canApprove(action)).toBe(false);
    expect(() => statusUpdatePayload(action, "approved")).toThrow(/missing information/i);
  });

  it("enforces forward-only approval transitions", () => {
    const draft = approvalFromRecord(record());
    const approvedPayload = statusUpdatePayload(draft, "approved");
    expect(approvedPayload.properties).toEqual({ status: "approved" });
    expect(approvedPayload.properties).not.toHaveProperty("approved_by");
    expect(approvedPayload.properties).not.toHaveProperty("approved_date");

    const completed = approvalFromRecord(record({
      properties: {
        ...(record().properties ?? {}),
        status: "completed",
        completed_date: "2026-09-03",
      },
    }));
    expect(() => statusUpdatePayload(completed, "approved")).toThrow(/cannot move/i);
  });

  it("sorts waiting actions first and prevents duplicate active proposals", () => {
    const approved = record({
      id: "approved",
      updatedAt: "2026-09-03T12:00:00Z",
      properties: {
        ...(record().properties ?? {}),
        status: "approved",
      },
    });
    const draft = record({
      id: "draft",
      updatedAt: "2026-09-02T12:00:00Z",
    });
    const completed = record({
      id: "completed",
      updatedAt: "2026-09-04T12:00:00Z",
      properties: {
        ...(record().properties ?? {}),
        status: "completed",
      },
    });

    const sorted = sortApprovals([completed, approved, draft]);
    expect(sorted.map((action) => action.id)).toEqual(["draft", "approved", "completed"]);

    const plan = normalizeAvaPlan("Create a job for Fletcher next Monday");
    expect(isDuplicateApproval(sorted, plan)).toBe(true);
  });
});
