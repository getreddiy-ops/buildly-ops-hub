import { describe, expect, it } from "vitest";
import type {
  FastTractLead,
  HighLevelEstimate,
  HighLevelInvoice,
  HighLevelRecord,
} from "@/integrations/highlevel/client";
import { buildHighLevelDashboard } from "./highlevelDashboard";

const now = new Date("2026-08-31T12:00:00-07:00");

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
    name: "Concrete patio",
    status: "draft",
    total: 2500,
    contactDetails: { name: "Morgan Customer" },
    ...overrides,
  };
}

function invoice(overrides: Partial<HighLevelInvoice> = {}): HighLevelInvoice {
  return {
    _id: "invoice-1",
    name: "Concrete patio invoice",
    status: "sent",
    total: 1200,
    amountDue: 1200,
    contactDetails: { name: "Morgan Customer" },
    ...overrides,
  };
}

function job(overrides: Partial<HighLevelRecord> = {}): HighLevelRecord {
  return {
    id: "job-1",
    properties: {
      "custom_objects.jobs.job_name": "Morgan patio",
      "custom_object.jobs.status": "scheduled",
      "custom_object.jobs.start_date": "2026-09-03",
    },
    ...overrides,
  };
}

describe("buildHighLevelDashboard", () => {
  it("ranks urgent money, accepted work, hot leads, and active jobs first", () => {
    const result = buildHighLevelDashboard({
      now,
      leads: [
        lead({ id: "qualified", status: "qualified", name: "Qualified customer" }),
        lead({ id: "contacted", status: "contacted", name: "Contacted customer" }),
      ],
      estimates: [
        estimate({ _id: "accepted", status: "accepted", total: 5000 }),
        estimate({ _id: "draft", status: "draft", total: 2500 }),
        estimate({ _id: "sent", status: "sent", total: 3000 }),
      ],
      invoices: [
        invoice({ _id: "overdue", status: "sent", amountDue: 1200, dueDate: "2026-08-25" }),
        invoice({ _id: "draft-invoice", status: "draft", total: 800, amountDue: 800, dueDate: "2026-09-05" }),
        invoice({ _id: "paid", status: "paid", total: 1000, amountDue: 0 }),
      ],
      jobs: [
        job({
          id: "active-job",
          properties: {
            "custom_objects.jobs.job_name": "Active patio",
            "custom_object.jobs.status": "active",
          },
        }),
        job({ id: "scheduled-job" }),
        job({
          id: "complete-job",
          properties: {
            "custom_objects.jobs.job_name": "Complete patio",
            "custom_object.jobs.status": "complete",
          },
        }),
      ],
    });

    expect(result.now.map((task) => task.id)).toEqual([
      "invoice:overdue",
      "estimate:accepted",
      "lead:qualified",
      "job:active-job",
    ]);
    expect(result.next.map((task) => task.id)).toEqual([
      "invoice:draft-invoice",
      "estimate:draft",
      "lead:contacted",
      "job:scheduled-job",
    ]);
    expect(result.later.map((task) => task.id)).toEqual(["estimate:sent"]);

    expect(result.metrics).toEqual({
      openLeads: 2,
      hotLeads: 1,
      activeJobs: 2,
      draftEstimates: 1,
      waitingEstimates: 1,
      estimatePipelineValue: 10500,
      readyToInvoiceValue: 5000,
      outstandingInvoiceValue: 2000,
      overdueInvoiceValue: 1200,
    });
  });

  it("puts jobs more than a week away in Later", () => {
    const result = buildHighLevelDashboard({
      now,
      leads: [],
      estimates: [],
      invoices: [],
      jobs: [job({
        id: "future-job",
        properties: {
          "custom_objects.jobs.job_name": "Future driveway",
          "custom_object.jobs.status": "scheduled",
          "custom_object.jobs.start_date": "2026-09-20",
        },
      })],
    });

    expect(result.now).toHaveLength(0);
    expect(result.next).toHaveLength(0);
    expect(result.later.map((task) => task.id)).toEqual(["job:future-job"]);
  });

  it("recommends a lead action when the first priority is a lead", () => {
    const result = buildHighLevelDashboard({
      now,
      leads: [lead({ status: "new" })],
      estimates: [],
      invoices: [],
      jobs: [],
    });

    expect(result.recommendedPrompt).toContain("lead");
  });

  it("returns a useful default when the business queue is empty", () => {
    const result = buildHighLevelDashboard({
      now,
      leads: [],
      estimates: [],
      invoices: [],
      jobs: [],
    });

    expect(result.now).toEqual([]);
    expect(result.next).toEqual([]);
    expect(result.later).toEqual([]);
    expect(result.recommendedPrompt).toBe("Show me the best next step for my business today");
  });
});
