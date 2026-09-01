import { describe, expect, it } from "vitest";
import type { HighLevelEstimate, HighLevelRecord } from "@/integrations/highlevel/client";
import {
  approvalEstimateForChangeOrder,
  approvalEstimatePayload,
  changeOrderFormFromRecord,
  changeOrderRecordPayload,
  changeOrderStatus,
  changeOrderTotal,
  linkedJobForChangeOrder,
  sortChangeOrders,
  summarizeChangeOrders,
  type ChangeOrderForm,
} from "./highlevelChangeOrders";

function job(overrides: Partial<HighLevelRecord> = {}): HighLevelRecord {
  return {
    id: "job-1",
    properties: {
      job_name: "Fletcher patio",
      customer_id: "contact-1",
      estimate_id: "estimate-original",
    },
    ...overrides,
  };
}

function changeOrder(overrides: Partial<HighLevelRecord> = {}): HighLevelRecord {
  return {
    id: "change-1",
    properties: {
      change_order_name: "Add two steps",
      job_id: "job-1",
      customer_id: "contact-1",
      estimate_id: "estimate-original",
      approval_estimate_id: "estimate-change",
      status: "sent",
      amount: 2500,
      tax_percent: 8.5,
      requested_date: "2026-08-31",
      description: "Form and pour two additional concrete steps.",
      notes: "Pump can reach from the driveway.",
    },
    ...overrides,
  };
}

function estimate(overrides: Partial<HighLevelEstimate> = {}): HighLevelEstimate {
  return {
    _id: "estimate-change",
    name: "Change Order — Add two steps",
    status: "sent",
    total: 2712.5,
    ...overrides,
  };
}

describe("highlevelChangeOrders", () => {
  it("uses the native approval estimate as the source of truth for workflow status", () => {
    const row = changeOrder();

    expect(changeOrderStatus(row, estimate({ status: "viewed" }))).toBe("sent");
    expect(changeOrderStatus(row, estimate({ status: "accepted" }))).toBe("approved");
    expect(changeOrderStatus(row, estimate({ status: "declined" }))).toBe("declined");
    expect(changeOrderStatus(row, estimate({ status: "invoiced" }))).toBe("invoiced");
    expect(changeOrderStatus(changeOrder({ properties: { ...row.properties, invoice_id: "invoice-1" } }), null)).toBe("invoiced");
  });

  it("builds a customer-facing native estimate without changing the original job scope", () => {
    const payload = approvalEstimatePayload(changeOrder(), job());

    expect(payload.title).toBe("Change Order — Add two steps");
    expect(payload.customer_id).toBe("contact-1");
    expect(payload.tax_percent).toBe(8.5);
    expect(payload.line_items).toEqual([
      {
        description: "Add two steps: Form and pour two additional concrete steps.",
        quantity: 1,
        unit_price: 2500,
      },
    ]);
    expect(payload.notes).toContain("CHANGE ORDER FOR: Fletcher patio");
    expect(payload.notes).toContain("outside the original agreed scope");
    expect(payload.notes).toContain("only after customer approval");
  });

  it("preserves workflow links and status when a draft is edited", () => {
    const existing = changeOrder();
    const form: ChangeOrderForm = {
      ...changeOrderFormFromRecord(existing),
      amount: 2750,
      description: "Form and pour two widened concrete steps.",
    };

    const payload = changeOrderRecordPayload(form, job(), existing).properties;

    expect(payload.job_id).toBe("job-1");
    expect(payload.customer_id).toBe("contact-1");
    expect(payload.estimate_id).toBe("estimate-original");
    expect(payload.approval_estimate_id).toBe("estimate-change");
    expect(payload.status).toBe("sent");
    expect(payload.amount).toBe(2750);
  });

  it("links records to the correct job and approval estimate", () => {
    const row = changeOrder();
    const jobs = [job(), job({ id: "job-2", properties: { job_name: "Other job" } })];
    const estimates = [estimate(), estimate({ _id: "estimate-other" })];

    expect(linkedJobForChangeOrder(row, jobs)?.id).toBe("job-1");
    expect(approvalEstimateForChangeOrder(row, estimates)?._id).toBe("estimate-change");
  });

  it("sorts action-ready changes first and summarizes customer-approved value", () => {
    const rows = [
      changeOrder({ id: "declined", properties: { ...changeOrder().properties, approval_estimate_id: "declined-estimate" } }),
      changeOrder({ id: "draft", properties: { ...changeOrder().properties, approval_estimate_id: null, status: "draft", amount: 1000, tax_percent: 0 } }),
      changeOrder({ id: "approved", properties: { ...changeOrder().properties, approval_estimate_id: "approved-estimate", amount: 3000, tax_percent: 0 } }),
      changeOrder({ id: "sent", properties: { ...changeOrder().properties, approval_estimate_id: "sent-estimate", amount: 2000, tax_percent: 0 } }),
      changeOrder({ id: "invoiced", properties: { ...changeOrder().properties, invoice_id: "invoice-1", amount: 4000, tax_percent: 0 } }),
    ];
    const estimates = [
      estimate({ _id: "declined-estimate", status: "declined" }),
      estimate({ _id: "approved-estimate", status: "accepted" }),
      estimate({ _id: "sent-estimate", status: "viewed" }),
    ];

    expect(sortChangeOrders(rows, estimates).map((row) => row.id)).toEqual([
      "approved",
      "draft",
      "sent",
      "invoiced",
      "declined",
    ]);

    expect(summarizeChangeOrders(rows, estimates)).toMatchObject({
      draftCount: 1,
      awaitingCount: 1,
      approvedCount: 1,
      invoicedCount: 1,
      draftValue: 1000,
      awaitingValue: 2000,
      approvedValue: 3000,
      invoicedValue: 4000,
    });
    expect(changeOrderTotal(changeOrder())).toBe(2712.5);
  });

  it("refuses to create an approval estimate without a linked customer or price", () => {
    const noCustomer = job({ properties: { job_name: "Unassigned work" } });
    expect(() => approvalEstimatePayload(
      changeOrder({ properties: { ...changeOrder().properties, customer_id: null } }),
      noCustomer,
    )).toThrow("Link a customer");

    expect(() => approvalEstimatePayload(
      changeOrder({ properties: { ...changeOrder().properties, amount: 0 } }),
      job(),
    )).toThrow("greater than zero");
  });
});
