import { describe, expect, it } from "vitest";
import type {
  FastTractLead,
  HighLevelEstimate,
  HighLevelInvoice,
  HighLevelRecord,
} from "@/integrations/highlevel/client";
import {
  avaSuggestions,
  buildAvaBusinessSnapshot,
  inferAvaIntent,
  normalizeAvaPlan,
  routeForAvaIntent,
  sanitizeAvaProposedChanges,
} from "./highlevelAva";

const now = new Date(2026, 7, 31, 12, 0, 0);

function lead(overrides: Partial<FastTractLead> = {}): FastTractLead {
  return {
    id: "lead-1",
    contact_id: "contact-1",
    name: "Morgan Customer",
    status: "new",
    ...overrides,
  };
}

function estimate(overrides: Partial<HighLevelEstimate> = {}): HighLevelEstimate {
  return {
    _id: "estimate-1",
    name: "Concrete estimate",
    status: "draft",
    total: 2500,
    ...overrides,
  };
}

function invoice(overrides: Partial<HighLevelInvoice> = {}): HighLevelInvoice {
  return {
    _id: "invoice-1",
    name: "Concrete invoice",
    status: "sent",
    total: 1200,
    amountDue: 1200,
    ...overrides,
  };
}

function job(overrides: Partial<HighLevelRecord> = {}): HighLevelRecord {
  return {
    id: "job-1",
    properties: {
      "custom_objects.jobs.job_name": "Morgan patio",
      "custom_object.jobs.status": "active",
    },
    ...overrides,
  };
}

describe("highlevelAva", () => {
  it("detects contractor intents before relying on a model route", () => {
    expect(inferAvaIntent("Build an estimate for a stamped patio")).toBe("create_estimate");
    expect(inferAvaIntent("Send the patio estimate to Branden")).toBe("send_estimate");
    expect(inferAvaIntent("Create a job for the Fletcher driveway")).toBe("create_job");
    expect(inferAvaIntent("Add a new lead from today's phone call")).toBe("create_lead");
    expect(inferAvaIntent("Add Branden Fletcher as a new customer")).toBe("create_customer");
    expect(inferAvaIntent("Prepare a change order for the extra retaining wall")).toBe("create_change_order");
    expect(inferAvaIntent("Log 8 hours for Mike on the patio job")).toBe("add_time");
    expect(inferAvaIntent("Record 10 yards of concrete on the job")).toBe("add_material");
    expect(inferAvaIntent("Create an invoice from the accepted estimate")).toBe("convert_estimate");
    expect(inferAvaIntent("Send invoice 1042 by email")).toBe("send_invoice");
    expect(inferAvaIntent("Record a $500 cash payment on invoice 1042")).toBe("record_payment");
    expect(inferAvaIntent("Draft a payment reminder for the overdue invoice")).toBe("follow_up_invoice");
  });

  it("routes create requests into approval-only prefilled workflows", () => {
    const prompt = "Create a job for Fletcher next Monday";
    const route = routeForAvaIntent("create_job", prompt);

    expect(route).toContain("/highlevel/jobs?new=1&prompt=");
    expect(decodeURIComponent(route)).toContain(prompt);

    const plan = normalizeAvaPlan(prompt, {
      intent: "review_money",
      summary: "A model chose the wrong workspace.",
      requires_approval: false,
      risk_level: "review",
    });

    expect(plan.intent).toBe("create_job");
    expect(plan.route).toContain("/highlevel/jobs?new=1");
    expect(plan.requiresApproval).toBe(true);
    expect(plan.riskLevel).toBe("record_change");
  });

  it("keeps customer and payment messages as reviewable drafts", () => {
    const plan = normalizeAvaPlan("Draft a payment reminder for invoice 1042", {
      intent: "follow_up_invoice",
      action_title: "Follow up on invoice 1042",
      target_label: "Invoice 1042",
      summary: "A reminder is ready for review.",
      next_step: "Review the text before doing anything else.",
      draft_content: "Hi Morgan, this is a reminder about invoice 1042.",
      proposed_changes: [
        { label: "Delivery", value: "Customer reminder" },
        { label: "Record ID", value: "model-picked-id" },
      ],
      missing_information: ["Preferred payment link", ""],
      requires_approval: false,
      risk_level: "review",
    });

    expect(plan.intent).toBe("follow_up_invoice");
    expect(plan.actionTitle).toBe("Follow up on invoice 1042");
    expect(plan.targetLabel).toBe("Invoice 1042");
    expect(plan.draftContent).toContain("invoice 1042");
    expect(plan.proposedChanges).toEqual([{ label: "Delivery", value: "Customer reminder" }]);
    expect(plan.missingInformation).toEqual(["Preferred payment link"]);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.riskLevel).toBe("customer_communication");
    expect(plan.route).toBe("/highlevel/money");
  });

  it("never lets model output lower the deterministic action risk", () => {
    const plan = normalizeAvaPlan("Record a $500 cash payment on invoice 1042", {
      intent: "review_money",
      risk_level: "review",
      requires_approval: false,
      proposed_changes: [
        { label: "Amount", value: 500 },
        { label: "Method", value: "cash" },
      ],
    });

    expect(plan.intent).toBe("record_payment");
    expect(plan.riskLevel).toBe("financial");
    expect(plan.requiresApproval).toBe(true);
    expect(plan.proposedChanges).toEqual([
      { label: "Amount", value: "500" },
      { label: "Method", value: "cash" },
    ]);
  });

  it("drops executable or credential-shaped proposal fields", () => {
    expect(sanitizeAvaProposedChanges([
      { label: "Route", value: "/api/highlevel/invoices" },
      { label: "Access token", value: "secret" },
      { label: "Customer", value: "Branden Fletcher" },
      "Verify the due date",
    ])).toEqual([
      { label: "Customer", value: "Branden Fletcher" },
      { label: "Proposed detail", value: "Verify the due date" },
    ]);
  });

  it("builds Ava's live pulse from the signed location data", () => {
    const snapshot = buildAvaBusinessSnapshot({
      now,
      leads: [lead({ status: "qualified" }), lead({ id: "lead-2", status: "contacted" })],
      estimates: [
        estimate({ _id: "accepted", status: "accepted", total: 5000 }),
        estimate({ _id: "draft", status: "draft", total: 2500 }),
      ],
      invoices: [
        invoice({ _id: "overdue", dueDate: "2026-08-20" }),
        invoice({ _id: "draft-invoice", status: "draft", total: 800, amountDue: 800 }),
      ],
      jobs: [job()],
    });

    expect(snapshot).toMatchObject({
      openLeads: 2,
      qualifiedLeads: 1,
      activeJobs: 1,
      draftEstimates: 1,
      acceptedEstimateValue: 5000,
      draftInvoiceValue: 800,
      outstandingInvoiceValue: 1200,
      overdueInvoiceValue: 1200,
    });
    expect(snapshot.topPriority).toContain("overdue");
  });

  it("uses the live pulse to offer useful starting requests", () => {
    const suggestions = avaSuggestions({
      openLeads: 3,
      qualifiedLeads: 2,
      activeJobs: 1,
      draftEstimates: 1,
      waitingEstimates: 0,
      acceptedEstimateValue: 5000,
      draftInvoiceValue: 0,
      outstandingInvoiceValue: 1200,
      overdueInvoiceValue: 1200,
      topPriority: "Invoice 1042 is overdue",
    });

    expect(suggestions).toHaveLength(4);
    expect(suggestions[0]).toContain("$1,200");
    expect(suggestions[1]).toContain("2 qualified leads");
    expect(suggestions[2]).toContain("$5,000");
  });
});
