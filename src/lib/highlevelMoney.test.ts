import { describe, expect, it } from "vitest";
import type { HighLevelEstimate, HighLevelInvoice } from "@/integrations/highlevel/client";
import {
  collectionPrompt,
  filterInvoices,
  invoiceAmountDue,
  invoiceIsOverdue,
  paymentProgress,
  sortInvoices,
  summarizeMoney,
} from "./highlevelMoney";

const now = new Date(2026, 7, 31, 12, 0, 0);

function estimate(overrides: Partial<HighLevelEstimate> = {}): HighLevelEstimate {
  return {
    _id: "estimate-1",
    name: "Concrete work",
    status: "accepted",
    total: 5000,
    contactDetails: { name: "Morgan Customer" },
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
    contactDetails: { name: "Morgan Customer" },
    ...overrides,
  };
}

describe("highlevelMoney", () => {
  it("summarizes accepted work, drafts, balances, overdue money, and paid revenue", () => {
    const estimates = [
      estimate({ _id: "accepted", status: "accepted", total: 5000 }),
      estimate({ _id: "draft-estimate", status: "draft", total: 2000 }),
    ];
    const invoices = [
      invoice({ _id: "draft", status: "draft", total: 800, amountDue: undefined }),
      invoice({ _id: "overdue", status: "sent", total: 1200, amountDue: 1200, dueDate: "2026-08-25" }),
      invoice({ _id: "partial", status: "partially_paid", total: 2000, amountPaid: 500, amountDue: 1500, dueDate: "2026-09-05" }),
      invoice({ _id: "paid", status: "paid", total: 1000, amountPaid: 1000, amountDue: 0 }),
    ];

    const summary = summarizeMoney(estimates, invoices, now);

    expect(summary.readyValue).toBe(5000);
    expect(summary.draftValue).toBe(800);
    expect(summary.outstandingValue).toBe(2700);
    expect(summary.overdueValue).toBe(1200);
    expect(summary.paidValue).toBe(1000);
  });

  it("does not mark a date-only invoice overdue until the following local day", () => {
    const dueToday = invoice({ dueDate: "2026-08-31" });
    const dueYesterday = invoice({ dueDate: "2026-08-30" });

    expect(invoiceIsOverdue(dueToday, now)).toBe(false);
    expect(invoiceIsOverdue(dueYesterday, now)).toBe(true);
  });

  it("puts overdue, draft, and partial-payment invoices at the top", () => {
    const rows = [
      invoice({ _id: "paid", status: "paid", total: 1000, amountPaid: 1000, amountDue: 0 }),
      invoice({ _id: "partial", status: "partially_paid", total: 2000, amountPaid: 500, amountDue: 1500, dueDate: "2026-09-05" }),
      invoice({ _id: "draft", status: "draft", total: 800, amountDue: 800 }),
      invoice({ _id: "overdue", status: "sent", dueDate: "2026-08-25" }),
    ];

    expect(sortInvoices(rows, now).map((row) => row._id)).toEqual([
      "overdue",
      "draft",
      "partial",
      "paid",
    ]);
  });

  it("filters the action and collection queues and searches customer details", () => {
    const rows = [
      invoice({ _id: "draft", status: "draft", total: 800, amountDue: 800, contactDetails: { name: "Branden Fletcher" } }),
      invoice({ _id: "overdue", status: "sent", dueDate: "2026-08-25", contactDetails: { name: "Morgan Customer" } }),
      invoice({ _id: "paid", status: "paid", total: 1000, amountPaid: 1000, amountDue: 0, contactDetails: { name: "Paid Customer" } }),
    ];

    expect(filterInvoices(rows, "action", "", now).map((row) => row._id)).toEqual(["overdue", "draft"]);
    expect(filterInvoices(rows, "outstanding", "", now).map((row) => row._id)).toEqual(["overdue"]);
    expect(filterInvoices(rows, "overdue", "", now).map((row) => row._id)).toEqual(["overdue"]);
    expect(filterInvoices(rows, "all", "Branden", now).map((row) => row._id)).toEqual(["draft"]);
  });

  it("calculates payment progress and keeps collection messages approval-only", () => {
    const partial = invoice({
      _id: "partial",
      invoiceNumber: "1042",
      status: "partially_paid",
      total: 2000,
      amountPaid: 500,
      amountDue: 1500,
      dueDate: "2026-08-25",
    });

    expect(invoiceAmountDue(partial)).toBe(1500);
    expect(paymentProgress(partial)).toBe(25);
    expect(collectionPrompt(partial, now)).toContain("Invoice 1042");
    expect(collectionPrompt(partial, now)).toContain("Show me the message for approval");
    expect(collectionPrompt(partial, now)).toContain("do not send it yet");
  });
});
